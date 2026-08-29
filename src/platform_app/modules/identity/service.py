"""Passwordless activation, sessions, usernames, and principals."""

import hashlib
import hmac
import re
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from platform_app.modules.identity.authorization import Principal, RoleGrant
from platform_app.modules.identity.models import (
    AccessSession,
    AccountStatus,
    EmailChallenge,
    EnrollmentState,
    ModerationState,
    Role,
    RoleAssignment,
    University,
    UniversityEmailDomain,
    UniversityIdentity,
    UniversityStatus,
    UserAccount,
    UserProfile,
    VerifiedResidence,
)
from platform_app.modules.identity.ports import EmailCodeSender
from platform_app.modules.university.contracts import (
    UniversityVerificationGateway,
    VerificationStatus,
)
from platform_app.modules.university.contracts import (
    VerifiedResidence as VerifiedResidenceContract,
)

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,24}$")


class IdentityError(ValueError):
    """Safe authentication error base."""


class UniversityDomainError(IdentityError):
    pass


class ChallengeRateLimitError(IdentityError):
    pass


class InvalidChallengeError(IdentityError):
    pass


class RosterIneligibleError(IdentityError):
    pass


class UsernameUnavailableError(IdentityError):
    pass


class InvalidSessionError(IdentityError):
    pass


@dataclass(frozen=True, slots=True)
class ChallengeIssued:
    challenge_id: UUID
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ActivatedSession:
    access_token: str
    expires_at: datetime
    username: str
    roles: tuple[Role, ...]


class IdentityService:
    """Coordinate passwordless verification and tenant-safe activation."""

    def __init__(
        self,
        session: Session,
        university_gateway: UniversityVerificationGateway,
        email_sender: EmailCodeSender,
        challenge_hmac_key: str,
        session_hmac_key: str,
        *,
        clock: Callable[[], datetime] | None = None,
        code_factory: Callable[[], str] | None = None,
        token_factory: Callable[[], str] | None = None,
    ) -> None:
        self._session = session
        self._university_gateway = university_gateway
        self._email_sender = email_sender
        self._challenge_hmac_key = challenge_hmac_key.encode()
        self._session_hmac_key = session_hmac_key.encode()
        self._clock = clock or (lambda: datetime.now(UTC))
        self._code_factory = code_factory or (
            lambda: f"{secrets.randbelow(1_000_000):06d}"
        )
        self._token_factory = token_factory or (lambda: secrets.token_urlsafe(32))

    def request_challenge(self, email: str) -> ChallengeIssued:
        normalized_email, domain = normalize_email(email)
        university = self._session.scalar(
            select(University)
            .join(
                UniversityEmailDomain,
                UniversityEmailDomain.university_id == University.id,
            )
            .where(
                UniversityEmailDomain.normalized_domain == domain,
                University.status == UniversityStatus.ACTIVE,
            )
        )
        if university is None or university.roster_reference is None:
            raise UniversityDomainError("email is not eligible for participation")

        now = self._now()
        recent_count = self._session.scalar(
            select(func.count(EmailChallenge.id)).where(
                EmailChallenge.normalized_email == normalized_email,
                EmailChallenge.created_at >= now - timedelta(minutes=15),
            )
        )
        if recent_count is not None and recent_count >= 3:
            raise ChallengeRateLimitError("too many verification requests")

        challenge = EmailChallenge(
            university_id=university.id,
            normalized_email=normalized_email,
            code_digest="pending",
            expires_at=now + timedelta(minutes=10),
            attempts=0,
            max_attempts=5,
            created_at=now,
        )
        self._session.add(challenge)
        self._session.flush()
        code = self._code_factory()
        challenge.code_digest = self._digest_challenge(challenge.id, code)
        self._email_sender.send_code(normalized_email, code, challenge.expires_at)
        return ChallengeIssued(challenge.id, challenge.expires_at)

    def verify_challenge(
        self, challenge_id: UUID, code: str, username: str
    ) -> ActivatedSession:
        challenge = self._session.scalar(
            select(EmailChallenge)
            .where(EmailChallenge.id == challenge_id)
            .with_for_update()
        )
        now = self._now()
        if (
            challenge is None
            or challenge.consumed_at is not None
            or challenge.expires_at <= now
            or challenge.attempts >= challenge.max_attempts
        ):
            raise InvalidChallengeError("verification code is invalid")
        expected_digest = self._digest_challenge(challenge.id, code)
        if not hmac.compare_digest(challenge.code_digest, expected_digest):
            challenge.attempts += 1
            self._session.flush()
            raise InvalidChallengeError("verification code is invalid")

        verification = self._university_gateway.verify_resident(
            challenge.normalized_email, now
        )
        university = self._session.get(University, challenge.university_id)
        if (
            university is None
            or verification.status is not VerificationStatus.ACTIVE
            or verification.residence is None
            or verification.student_reference is None
            or verification.university_reference != university.roster_reference
        ):
            challenge.consumed_at = now
            self._session.flush()
            raise RosterIneligibleError("active enrolment and residence are required")

        normalized_username = normalize_username(username)
        identity = self._session.scalar(
            select(UniversityIdentity).where(
                UniversityIdentity.university_id == university.id,
                UniversityIdentity.normalized_email == challenge.normalized_email,
            )
        )
        if identity is None:
            account = UserAccount(status=AccountStatus.ACTIVE)
            self._session.add(account)
            self._session.flush()
            identity = UniversityIdentity(
                university_id=university.id,
                account_id=account.id,
                normalized_email=challenge.normalized_email,
                external_student_reference=verification.student_reference,
                enrollment_state=EnrollmentState.ACTIVE,
            )
            self._session.add(identity)
            self._session.flush()
        else:
            existing_account = self._session.get(UserAccount, identity.account_id)
            if (
                existing_account is None
                or existing_account.status is not AccountStatus.ACTIVE
            ):
                raise RosterIneligibleError("account is not active")
            account = existing_account
            identity.external_student_reference = verification.student_reference
            identity.enrollment_state = EnrollmentState.ACTIVE

        profile = self._upsert_profile(identity, username, normalized_username)
        self._upsert_participant_role(account.id, university.id)
        self._record_residence(identity, verification.residence, now)
        challenge.consumed_at = now
        token = self._token_factory()
        access_session = AccessSession(
            account_id=account.id,
            token_digest=self._digest_session(token),
            expires_at=now + timedelta(hours=1),
            created_at=now,
        )
        self._session.add(access_session)
        self._session.flush()
        return ActivatedSession(
            access_token=token,
            expires_at=access_session.expires_at,
            username=profile.username,
            roles=(Role.PARTICIPANT,),
        )

    def principal_for_token(self, token: str) -> Principal:
        now = self._now()
        access_session = self._session.scalar(
            select(AccessSession).where(
                AccessSession.token_digest == self._digest_session(token),
                AccessSession.revoked_at.is_(None),
                AccessSession.expires_at > now,
            )
        )
        if access_session is None:
            raise InvalidSessionError("access token is invalid")
        assignments = self._session.scalars(
            select(RoleAssignment).where(
                RoleAssignment.account_id == access_session.account_id
            )
        )
        return Principal(
            account_id=access_session.account_id,
            grants=tuple(
                RoleGrant(row.role, row.university_id, row.building_id)
                for row in assignments
            ),
        )

    def change_username(self, principal: Principal, username: str) -> str:
        normalized = normalize_username(username)
        identity = self._session.scalar(
            select(UniversityIdentity).where(
                UniversityIdentity.account_id == principal.account_id
            )
        )
        if identity is None:
            raise InvalidSessionError("participant identity is missing")
        profile = self._session.scalar(
            select(UserProfile).where(UserProfile.identity_id == identity.id)
        )
        if profile is None:
            raise InvalidSessionError("participant profile is missing")
        existing = self._session.scalar(
            select(UserProfile).where(
                UserProfile.university_id == identity.university_id,
                UserProfile.normalized_username == normalized,
                UserProfile.id != profile.id,
            )
        )
        if existing is not None:
            raise UsernameUnavailableError("username is unavailable")
        profile.username = username
        profile.normalized_username = normalized
        self._session.flush()
        return profile.username

    def _upsert_profile(
        self, identity: UniversityIdentity, username: str, normalized_username: str
    ) -> UserProfile:
        profile = self._session.scalar(
            select(UserProfile).where(UserProfile.identity_id == identity.id)
        )
        conflict = self._session.scalar(
            select(UserProfile).where(
                UserProfile.university_id == identity.university_id,
                UserProfile.normalized_username == normalized_username,
                UserProfile.identity_id != identity.id,
            )
        )
        if conflict is not None:
            raise UsernameUnavailableError("username is unavailable")
        if profile is None:
            profile = UserProfile(
                university_id=identity.university_id,
                identity_id=identity.id,
                username=username,
                normalized_username=normalized_username,
                moderation_state=ModerationState.ACTIVE,
            )
            self._session.add(profile)
        else:
            profile.username = username
            profile.normalized_username = normalized_username
        self._session.flush()
        return profile

    def _upsert_participant_role(self, account_id: UUID, university_id: UUID) -> None:
        assignment = self._session.scalar(
            select(RoleAssignment).where(
                RoleAssignment.account_id == account_id,
                RoleAssignment.role == Role.PARTICIPANT,
                RoleAssignment.university_id == university_id,
            )
        )
        if assignment is None:
            self._session.add(
                RoleAssignment(
                    account_id=account_id,
                    role=Role.PARTICIPANT,
                    university_id=university_id,
                    building_id=None,
                )
            )
            self._session.flush()

    def _record_residence(
        self,
        identity: UniversityIdentity,
        residence: VerifiedResidenceContract,
        now: datetime,
    ) -> None:
        current = self._session.scalar(
            select(VerifiedResidence).where(
                VerifiedResidence.identity_id == identity.id,
                VerifiedResidence.effective_end.is_(None),
            )
        )
        if current is not None:
            unchanged = (
                current.building_reference == residence.building_reference
                and current.apartment_reference == residence.apartment_reference
                and current.room_reference == residence.room_reference
                and current.source_version == residence.source_version
            )
            if unchanged:
                current.verified_at = now
                return
            current.effective_end = now
        self._session.add(
            VerifiedResidence(
                university_id=identity.university_id,
                identity_id=identity.id,
                building_reference=residence.building_reference,
                apartment_reference=residence.apartment_reference,
                room_reference=residence.room_reference,
                source_version=residence.source_version,
                effective_start=now,
                effective_end=None,
                verified_at=now,
            )
        )

    def _digest_challenge(self, challenge_id: UUID, code: str) -> str:
        return hmac.new(
            self._challenge_hmac_key,
            f"{challenge_id}:{code}".encode(),
            hashlib.sha256,
        ).hexdigest()

    def _digest_session(self, token: str) -> str:
        return hmac.new(
            self._session_hmac_key, token.encode(), hashlib.sha256
        ).hexdigest()

    def _now(self) -> datetime:
        now = self._clock()
        if now.utcoffset() is None:
            raise RuntimeError("identity clock must return a timezone-aware instant")
        return now


def normalize_email(email: str) -> tuple[str, str]:
    normalized = email.strip().casefold()
    local, separator, domain = normalized.rpartition("@")
    if separator == "" or local == "" or domain == "":
        raise UniversityDomainError("email is not eligible for participation")
    return normalized, domain


def normalize_username(username: str) -> str:
    if USERNAME_PATTERN.fullmatch(username) is None:
        raise UsernameUnavailableError(
            "username must contain 3-24 letters, numbers, or underscores"
        )
    return username.casefold()
