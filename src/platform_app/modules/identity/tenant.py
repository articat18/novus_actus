"""Tenant-scoped identity repository and explicit platform override."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from platform_app.modules.identity.models import AuditEvent, UserProfile


class TenantAccessDeniedError(PermissionError):
    """Raised when a tenant context addresses another tenant's data."""


@dataclass(frozen=True, slots=True)
class TenantContext:
    """Authenticated context for one university tenant."""

    university_id: UUID
    actor_account_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class PlatformTenantOverride:
    """Explicit, attributable selection of a tenant by a platform operator."""

    actor_account_id: UUID
    target_university_id: UUID
    reason: str

    def __post_init__(self) -> None:
        if not self.reason.strip():
            raise ValueError("a platform tenant override requires a reason")


TenantScope = TenantContext | PlatformTenantOverride


class IdentityRepository:
    """Identity reads that deny cross-tenant access by default."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list_profiles(self, scope: TenantScope) -> list[UserProfile]:
        university_id = self._university_id(scope)
        self._audit_override(scope, "user_profile", None)
        return list(
            self._session.scalars(
                select(UserProfile)
                .where(UserProfile.university_id == university_id)
                .order_by(UserProfile.id)
            )
        )

    def get_profile(self, profile_id: UUID, scope: TenantScope) -> UserProfile:
        profile = self._session.get(UserProfile, profile_id)
        if profile is None:
            raise LookupError("profile not found")

        university_id = self._university_id(scope)
        if profile.university_id != university_id:
            raise TenantAccessDeniedError("profile belongs to another university")

        self._audit_override(scope, "user_profile", profile.id)
        return profile

    @staticmethod
    def _university_id(scope: TenantScope) -> UUID:
        if isinstance(scope, PlatformTenantOverride):
            return scope.target_university_id
        return scope.university_id

    def _audit_override(
        self, scope: TenantScope, target_type: str, target_id: UUID | None
    ) -> None:
        if not isinstance(scope, PlatformTenantOverride):
            return
        self._session.add(
            AuditEvent(
                university_id=scope.target_university_id,
                actor_account_id=scope.actor_account_id,
                action="platform.cross_tenant.read",
                target_type=target_type,
                target_id=target_id,
                reason=scope.reason,
                before_state=None,
                after_state={"selected_university_id": str(scope.target_university_id)},
            )
        )
        self._session.flush()
