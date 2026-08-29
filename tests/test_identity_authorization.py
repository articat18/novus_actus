"""REQ-TEN-001 deny-by-default role matrix."""

from uuid import uuid4

import pytest

from platform_app.modules.identity.authorization import (
    AccessDeniedError,
    AuthorizationService,
    Permission,
    Principal,
    RoleGrant,
)
from platform_app.modules.identity.models import Role


def test_participant_is_limited_to_self_in_own_tenant() -> None:
    university_id = uuid4()
    other_university_id = uuid4()
    building_id = uuid4()
    principal = Principal(uuid4(), (RoleGrant(Role.PARTICIPANT, university_id, None),))
    authorization = AuthorizationService()

    authorization.require(principal, Permission.VIEW_SELF, university_id=university_id)
    for permission, tenant, building in (
        (Permission.VIEW_SELF, other_university_id, None),
        (Permission.VIEW_BUILDING, university_id, building_id),
        (Permission.MANAGE_BUILDING, university_id, building_id),
        (Permission.SELECT_TENANT, university_id, None),
    ):
        with pytest.raises(AccessDeniedError):
            authorization.require(
                principal,
                permission,
                university_id=tenant,
                building_id=building,
            )


def test_building_admin_is_limited_to_assigned_building_and_tenant() -> None:
    university_id = uuid4()
    building_id = uuid4()
    principal = Principal(
        uuid4(),
        (RoleGrant(Role.BUILDING_ADMIN, university_id, building_id),),
    )
    authorization = AuthorizationService()

    for permission in (Permission.VIEW_BUILDING, Permission.MANAGE_BUILDING):
        authorization.require(
            principal,
            permission,
            university_id=university_id,
            building_id=building_id,
        )
    for tenant, building in (
        (university_id, uuid4()),
        (uuid4(), building_id),
    ):
        with pytest.raises(AccessDeniedError):
            authorization.require(
                principal,
                Permission.MANAGE_BUILDING,
                university_id=tenant,
                building_id=building,
            )


def test_platform_admin_requires_explicit_target_selection() -> None:
    principal = Principal(uuid4(), (RoleGrant(Role.PLATFORM_ADMIN, None, None),))
    authorization = AuthorizationService()
    target_university = uuid4()

    with pytest.raises(AccessDeniedError):
        authorization.require(
            principal,
            Permission.SELECT_TENANT,
            university_id=target_university,
        )
    authorization.require(
        principal,
        Permission.SELECT_TENANT,
        university_id=target_university,
        platform_target_explicit=True,
    )


def test_unknown_role_set_denies_every_operation() -> None:
    principal = Principal(uuid4(), ())

    with pytest.raises(AccessDeniedError):
        AuthorizationService().require(
            principal,
            Permission.VIEW_SELF,
            university_id=uuid4(),
        )
