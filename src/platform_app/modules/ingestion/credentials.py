"""Provision and authenticate independently revocable meter credentials."""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from platform_app.modules.identity.tenant import TenantContext
from platform_app.modules.ingestion.models import (
    MeterAuthenticationAttempt,
    MeterCredential,
)
from platform_app.modules.topology.repository import TopologyRepository
from platform_app.persistence.conventions import utc_now


class MeterCredentialRejectedError(PermissionError):
    """Credential authentication is denied without revealing why."""


class MeterRateLimitExceededError(PermissionError):
    """The meter authentication attempt budget is exhausted."""


@dataclass(frozen=True, slots=True)
class ProvisionedMeterCredential:
    credential_id: UUID
    secret: str


class MeterCredentialService:
    def __init__(
        self,
        session: Session,
        *,
        max_attempts: int = 30,
        attempt_window: timedelta = timedelta(minutes=1),
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        self._session = session
        self._topology = TopologyRepository(session)
        self._max_attempts = max_attempts
        self._attempt_window = attempt_window

    def provision(
        self,
        meter_id: UUID,
        scope: TenantContext,
        *,
        rotated_from_id: UUID | None = None,
    ) -> ProvisionedMeterCredential:
        meter = self._topology.get_meter(meter_id, scope)
        secret = secrets.token_urlsafe(32)
        salt = secrets.token_bytes(16)
        credential = MeterCredential(
            university_id=meter.university_id,
            meter_id=meter.id,
            secret_hash=self._hash(secret, salt),
            salt=salt,
            rotated_from_id=rotated_from_id,
        )
        self._session.add(credential)
        self._session.flush()
        return ProvisionedMeterCredential(credential.id, secret)

    def authenticate(
        self,
        meter_id: UUID,
        secret: str,
        scope: TenantContext,
        *,
        now: datetime | None = None,
    ) -> MeterCredential:
        instant = now or utc_now()
        meter = self._topology.get_meter(meter_id, scope)
        attempt_count = self._session.scalar(
            select(func.count())
            .select_from(MeterAuthenticationAttempt)
            .where(
                MeterAuthenticationAttempt.university_id == scope.university_id,
                MeterAuthenticationAttempt.meter_id == meter.id,
                MeterAuthenticationAttempt.attempted_at
                >= instant - self._attempt_window,
            )
        )
        if attempt_count is not None and attempt_count >= self._max_attempts:
            raise MeterRateLimitExceededError("meter authentication denied")

        credentials = list(
            self._session.scalars(
                select(MeterCredential).where(
                    MeterCredential.university_id == scope.university_id,
                    MeterCredential.meter_id == meter.id,
                    MeterCredential.revoked_at.is_(None),
                )
            )
        )
        matched = next(
            (
                credential
                for credential in credentials
                if hmac.compare_digest(
                    credential.secret_hash, self._hash(secret, credential.salt)
                )
            ),
            None,
        )
        self._record_attempt(meter.id, scope.university_id, matched, instant)
        if matched is None:
            raise MeterCredentialRejectedError("meter authentication denied")
        return matched

    def revoke(
        self,
        credential_id: UUID,
        meter_id: UUID,
        scope: TenantContext,
        *,
        now: datetime | None = None,
    ) -> None:
        self._topology.get_meter(meter_id, scope)
        credential = self._session.scalar(
            select(MeterCredential)
            .where(
                MeterCredential.id == credential_id,
                MeterCredential.meter_id == meter_id,
                MeterCredential.university_id == scope.university_id,
            )
            .with_for_update()
        )
        if credential is None:
            raise MeterCredentialRejectedError("meter credential not found")
        credential.revoked_at = now or utc_now()
        self._session.flush()

    def rotate(
        self,
        credential_id: UUID,
        meter_id: UUID,
        scope: TenantContext,
        *,
        now: datetime | None = None,
    ) -> ProvisionedMeterCredential:
        self.revoke(credential_id, meter_id, scope, now=now)
        return self.provision(meter_id, scope, rotated_from_id=credential_id)

    def _record_attempt(
        self,
        meter_id: UUID,
        university_id: UUID,
        credential: MeterCredential | None,
        instant: datetime,
    ) -> None:
        self._session.add(
            MeterAuthenticationAttempt(
                university_id=university_id,
                meter_id=meter_id,
                credential_id=credential.id if credential else None,
                accepted=credential is not None,
                reason="accepted" if credential else "rejected",
                attempted_at=instant,
            )
        )
        self._session.flush()

    @staticmethod
    def _hash(secret: str, salt: bytes) -> bytes:
        return hashlib.scrypt(
            secret.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32
        )
