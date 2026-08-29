"""Deny-by-default role authorization primitives."""

from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from platform_app.modules.identity.models import Role


class AccessDeniedError(PermissionError):
    """Raised when no explicit role grant permits an operation."""


class Permission(StrEnum):
    VIEW_SELF = "view_self"
    VIEW_BUILDING = "view_building"
    MANAGE_BUILDING = "manage_building"
    SELECT_TENANT = "select_tenant"


@dataclass(frozen=True, slots=True)
class RoleGrant:
    role: Role
    university_id: UUID | None
    building_id: UUID | None


@dataclass(frozen=True, slots=True)
class Principal:
    account_id: UUID
    grants: tuple[RoleGrant, ...]


class AuthorizationService:
    """Authorize only explicit role, tenant, and building combinations."""

    def require(
        self,
        principal: Principal,
        permission: Permission,
        *,
        university_id: UUID,
        building_id: UUID | None = None,
        platform_target_explicit: bool = False,
    ) -> None:
        for grant in principal.grants:
            if grant.role is Role.PLATFORM_ADMIN:
                if platform_target_explicit:
                    return
                continue
            if grant.university_id != university_id:
                continue
            if grant.role is Role.PARTICIPANT and permission is Permission.VIEW_SELF:
                return
            if grant.role is Role.BUILDING_ADMIN:
                if permission is Permission.VIEW_SELF:
                    return
                if (
                    permission in {Permission.VIEW_BUILDING, Permission.MANAGE_BUILDING}
                    and building_id is not None
                    and grant.building_id == building_id
                ):
                    return
        raise AccessDeniedError("operation is not authorized")
