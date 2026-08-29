"""REQ-ID-001/002/003 identity API and privacy outcomes."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from platform_app import create_app
from platform_app.modules.identity.api import IdentityRuntime
from platform_app.modules.identity.models import (
    AccessSession,
    EmailChallenge,
    Role,
    University,
    UniversityEmailDomain,
    UniversityIdentity,
    UniversityStatus,
    UserAccount,
    UserProfile,
    VerifiedResidence,
)
from platform_app.modules.identity.ports import InMemoryEmailCodeSender
from platform_app.modules.identity.service import (
    ChallengeRateLimitError,
    IdentityService,
    InvalidChallengeError,
    InvalidSessionError,
    RosterIneligibleError,
    UniversityDomainError,
    UsernameUnavailableError,
)
from platform_app.modules.university.contracts import (
    UniversityVerification,
    VerificationStatus,
)
from platform_app.modules.university.contracts import (
    VerifiedResidence as VerifiedResidenceContract,
)
from platform_app.settings import PlatformSettings

pytestmark = pytest.mark.integration
NOW = datetime(2026, 8, 29, 0, 0, tzinfo=UTC)
CHALLENGE_KEY = "challenge-key-that-is-at-least-32-bytes"
SESSION_KEY = "session-key-that-is-at-least-32-bytes-long"


class FakeUniversityGateway:
    def __init__(self) -> None:
        self.results: dict[str, UniversityVerification] = {}

    def verify_resident(self, email: str, at: datetime) -> UniversityVerification:
        del at
        return self.results[email]


class MutableClock:
    def __init__(self, now: datetime = NOW) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now


def active_verification(
    student_reference: str,
    university_reference: str = "demo-university",
) -> UniversityVerification:
    return UniversityVerification(
        status=VerificationStatus.ACTIVE,
        university_reference=university_reference,
        student_reference=student_reference,
        residence=VerifiedResidenceContract(
            building_reference="hall-1",
            apartment_reference="hall-1-a01",
            room_reference="hall-1-a01-r1",
            source_version="residence-v1",
        ),
    )


def add_university(
    session: Session,
    *,
    name: str = "Demo University",
    domain: str = "demo.edu",
    roster_reference: str = "demo-university",
) -> University:
    university = University(
        name=name,
        timezone="Asia/Singapore",
        roster_reference=roster_reference,
        status=UniversityStatus.ACTIVE,
    )
    session.add(university)
    session.flush()
    session.add(
        UniversityEmailDomain(
            university_id=university.id,
            normalized_domain=domain,
        )
    )
    session.flush()
    return university


def make_service(
    session: Session,
    gateway: FakeUniversityGateway,
    sender: InMemoryEmailCodeSender,
    clock: MutableClock,
    *,
    code: str = "123456",
    token: str = "private-access-token",
) -> IdentityService:
    return IdentityService(
        session,
        gateway,
        sender,
        CHALLENGE_KEY,
        SESSION_KEY,
        clock=clock,
        code_factory=lambda: code,
        token_factory=lambda: token,
    )


def activate(
    service: IdentityService,
    gateway: FakeUniversityGateway,
    email: str,
    username: str,
    student_reference: str,
) -> str:
    gateway.results[email] = active_verification(student_reference)
    issued = service.request_challenge(email)
    return service.verify_challenge(
        issued.challenge_id, "123456", username
    ).access_token


def test_university_domain_required_and_request_does_not_create_account(
    db_session: Session,
) -> None:
    add_university(db_session)
    service = make_service(
        db_session,
        FakeUniversityGateway(),
        InMemoryEmailCodeSender(),
        MutableClock(),
    )

    issued = service.request_challenge("Student@Demo.Edu")

    assert issued.expires_at == NOW + timedelta(minutes=10)
    assert db_session.scalar(select(func.count(UserAccount.id))) == 0
    with pytest.raises(UniversityDomainError):
        service.request_challenge("person@gmail.com")
    assert db_session.scalar(select(func.count(UserAccount.id))) == 0


def test_valid_code_activates_once_and_stores_private_roster_state(
    db_session: Session,
) -> None:
    university = add_university(db_session)
    gateway = FakeUniversityGateway()
    sender = InMemoryEmailCodeSender()
    service = make_service(db_session, gateway, sender, MutableClock())
    gateway.results["active@demo.edu"] = active_verification("student-active")
    issued = service.request_challenge("active@demo.edu")

    activated = service.verify_challenge(issued.challenge_id, "123456", "EcoHero")

    assert activated.access_token == "private-access-token"
    assert activated.roles == (Role.PARTICIPANT,)
    assert sender.code_for("active@demo.edu") == "123456"
    identity = db_session.scalar(select(UniversityIdentity))
    residence = db_session.scalar(select(VerifiedResidence))
    stored_session = db_session.scalar(select(AccessSession))
    assert identity is not None
    assert identity.university_id == university.id
    assert identity.normalized_email == "active@demo.edu"
    assert residence is not None
    assert residence.apartment_reference == "hall-1-a01"
    assert stored_session is not None
    assert stored_session.token_digest != activated.access_token
    with pytest.raises(InvalidChallengeError):
        service.verify_challenge(issued.challenge_id, "123456", "EcoHero")


def test_expired_reused_and_incorrect_codes_are_rejected(db_session: Session) -> None:
    add_university(db_session)
    gateway = FakeUniversityGateway()
    sender = InMemoryEmailCodeSender()
    clock = MutableClock()
    service = make_service(db_session, gateway, sender, clock)
    expired = service.request_challenge("expired@demo.edu")
    clock.now += timedelta(minutes=11)
    with pytest.raises(InvalidChallengeError):
        service.verify_challenge(expired.challenge_id, "123456", "ExpiredUser")

    clock.now = NOW
    limited = service.request_challenge("attempts@demo.edu")
    for _ in range(5):
        with pytest.raises(InvalidChallengeError):
            service.verify_challenge(limited.challenge_id, "000000", "AttemptUser")
    with pytest.raises(InvalidChallengeError):
        service.verify_challenge(limited.challenge_id, "123456", "AttemptUser")
    challenge = db_session.get(EmailChallenge, limited.challenge_id)
    assert challenge is not None
    assert challenge.attempts == 5


def test_challenge_request_rate_limit_is_enforced(db_session: Session) -> None:
    add_university(db_session)
    service = make_service(
        db_session,
        FakeUniversityGateway(),
        InMemoryEmailCodeSender(),
        MutableClock(),
    )

    for _ in range(3):
        service.request_challenge("rate@demo.edu")
    with pytest.raises(ChallengeRateLimitError):
        service.request_challenge("rate@demo.edu")


@pytest.mark.parametrize(
    "verification",
    [
        UniversityVerification(status=VerificationStatus.NOT_FOUND),
        UniversityVerification(
            status=VerificationStatus.INACTIVE,
            university_reference="demo-university",
            student_reference="inactive-student",
        ),
        UniversityVerification(
            status=VerificationStatus.ACTIVE,
            university_reference="demo-university",
            student_reference="no-residence",
        ),
    ],
)
def test_ineligible_roster_result_never_creates_participant(
    db_session: Session, verification: UniversityVerification
) -> None:
    add_university(db_session)
    gateway = FakeUniversityGateway()
    gateway.results["ineligible@demo.edu"] = verification
    service = make_service(
        db_session, gateway, InMemoryEmailCodeSender(), MutableClock()
    )
    issued = service.request_challenge("ineligible@demo.edu")

    with pytest.raises(RosterIneligibleError):
        service.verify_challenge(issued.challenge_id, "123456", "NoEntry")

    assert db_session.scalar(select(func.count(UserAccount.id))) == 0
    challenge = db_session.get(EmailChallenge, issued.challenge_id)
    assert challenge is not None
    assert challenge.consumed_at == NOW


def test_username_is_unique_within_university_but_reusable_across_tenants(
    db_session: Session,
) -> None:
    add_university(db_session)
    add_university(
        db_session,
        name="Other University",
        domain="other.edu",
        roster_reference="other-university",
    )
    gateway = FakeUniversityGateway()
    sender = InMemoryEmailCodeSender()
    service = make_service(db_session, gateway, sender, MutableClock())
    activate(service, gateway, "first@demo.edu", "SharedName", "student-1")
    gateway.results["second@demo.edu"] = active_verification("student-2")
    second = service.request_challenge("second@demo.edu")
    with pytest.raises(UsernameUnavailableError), db_session.begin_nested():
        service.verify_challenge(second.challenge_id, "123456", "sharedname")

    gateway.results["other@other.edu"] = active_verification(
        "other-student", "other-university"
    )
    other_service = make_service(
        db_session, gateway, sender, MutableClock(), token="other-access-token"
    )
    other = other_service.request_challenge("other@other.edu")
    other_service.verify_challenge(other.challenge_id, "123456", "SharedName")

    profiles = list(db_session.scalars(select(UserProfile)))
    assert [profile.username for profile in profiles] == ["SharedName", "SharedName"]
    assert profiles[0].university_id != profiles[1].university_id


def test_session_resolution_rejects_revoked_session(db_session: Session) -> None:
    add_university(db_session)
    gateway = FakeUniversityGateway()
    service = make_service(
        db_session, gateway, InMemoryEmailCodeSender(), MutableClock()
    )
    token = activate(service, gateway, "active@demo.edu", "EcoHero", "student-1")

    principal = service.principal_for_token(token)

    assert principal.grants[0].role is Role.PARTICIPANT
    stored_session = db_session.scalar(select(AccessSession))
    assert stored_session is not None
    stored_session.revoked_at = NOW
    db_session.flush()
    with pytest.raises(InvalidSessionError):
        service.principal_for_token(token)


@pytest.fixture
def identity_api(
    postgres_engine: Engine,
) -> Iterator[tuple[TestClient, InMemoryEmailCodeSender]]:
    connection = postgres_engine.connect()
    outer_transaction = connection.begin()

    def session_factory() -> Session:
        return Session(bind=connection, join_transaction_mode="create_savepoint")

    with session_factory() as session:
        add_university(session)
        session.commit()
    gateway = FakeUniversityGateway()
    gateway.results["active@demo.edu"] = active_verification("student-active")
    sender = InMemoryEmailCodeSender()
    runtime = IdentityRuntime(
        gateway,
        sender,
        CHALLENGE_KEY,
        SESSION_KEY,
        clock=MutableClock(),
        code_factory=lambda: "123456",
        token_factory=lambda: "api-private-token",
    )
    settings = PlatformSettings(
        database_url="postgresql+psycopg://unused/platform",
        university_api_url="https://university.test",
        challenge_hmac_key=CHALLENGE_KEY,
        session_hmac_key=SESSION_KEY,
    )
    with TestClient(create_app(settings, session_factory, runtime)) as client:
        yield client, sender
    outer_transaction.rollback()
    connection.close()


def test_identity_api_returns_only_public_session_fields_and_logs_no_secrets(
    identity_api: tuple[TestClient, InMemoryEmailCodeSender],
    caplog: pytest.LogCaptureFixture,
) -> None:
    client, sender = identity_api
    challenge_response = client.post(
        "/v1/auth/challenges", json={"email": "active@demo.edu"}
    )
    challenge_body = challenge_response.json()
    verify_response = client.post(
        "/v1/auth/challenges/verify",
        json={
            "challenge_id": challenge_body["challenge_id"],
            "code": sender.code_for("active@demo.edu"),
            "username": "EcoHero",
        },
    )

    assert challenge_response.status_code == 202
    assert verify_response.status_code == 200
    assert set(verify_response.json()) == {
        "access_token",
        "token_type",
        "expires_at",
        "username",
        "roles",
    }
    serialized = verify_response.text
    assert "active@demo.edu" not in serialized
    assert "hall-1-a01" not in serialized
    assert "123456" not in serialized
    assert "active@demo.edu" not in caplog.text
    assert "123456" not in caplog.text

    repeat_challenge = client.post(
        "/v1/auth/challenges", json={"email": "active@demo.edu"}
    )
    assert repeat_challenge.status_code == challenge_response.status_code
    assert set(repeat_challenge.json()) == set(challenge_body)
    assert repeat_challenge.json()["message"] == challenge_body["message"]

    rename = client.patch(
        "/v1/me/username",
        headers={"Authorization": "Bearer api-private-token"},
        json={"username": "EcoLeader"},
    )
    assert rename.status_code == 200
    assert rename.json() == {"username": "EcoLeader"}
