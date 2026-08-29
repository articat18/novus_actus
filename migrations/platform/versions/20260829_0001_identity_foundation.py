"""Add tenant-aware identity persistence foundation.

Revision ID: 20260829_0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260829_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp_columns() -> tuple[sa.Column, sa.Column, sa.Column]:
    return (
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        "university",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("timezone", sa.String(length=100), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "inactive",
                name="university_status",
            ),
            nullable=False,
        ),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_university")),
    )
    op.create_table(
        "user_account",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "deleted",
                name="account_status",
            ),
            nullable=False,
        ),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_account")),
    )
    op.create_table(
        "university_email_domain",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("normalized_domain", sa.String(length=255), nullable=False),
        *timestamp_columns(),
        sa.CheckConstraint(
            "normalized_domain = lower(normalized_domain)",
            name=op.f("ck_university_email_domain_normalized_domain_lowercase"),
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_university_email_domain_university_id_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_university_email_domain")),
        sa.UniqueConstraint(
            "normalized_domain",
            name=op.f("uq_university_email_domain_normalized_domain"),
        ),
    )
    op.create_index(
        op.f("ix_university_email_domain_university_id"),
        "university_email_domain",
        ["university_id"],
    )
    op.create_table(
        "university_identity",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("normalized_email", sa.String(length=320), nullable=False),
        sa.Column("external_student_reference", sa.String(length=200), nullable=False),
        sa.Column(
            "enrollment_state",
            sa.Enum(
                "pending",
                "active",
                "inactive",
                name="enrollment_state",
            ),
            nullable=False,
        ),
        *timestamp_columns(),
        sa.CheckConstraint(
            "normalized_email = lower(normalized_email)",
            name=op.f("ck_university_identity_normalized_email_lowercase"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["user_account.id"],
            name=op.f("fk_university_identity_account_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_university_identity_university_id_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_university_identity")),
        sa.UniqueConstraint(
            "university_id",
            "external_student_reference",
            name="uq_university_identity_university_student_reference",
        ),
        sa.UniqueConstraint(
            "university_id",
            "normalized_email",
            name="uq_university_identity_university_email",
        ),
    )
    op.create_index(
        op.f("ix_university_identity_account_id"),
        "university_identity",
        ["account_id"],
    )
    op.create_index(
        op.f("ix_university_identity_university_id"),
        "university_identity",
        ["university_id"],
    )
    op.create_table(
        "user_profile",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("identity_id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("normalized_username", sa.String(length=40), nullable=False),
        sa.Column(
            "moderation_state",
            sa.Enum(
                "active",
                "replaced",
                name="moderation_state",
            ),
            nullable=False,
        ),
        *timestamp_columns(),
        sa.CheckConstraint(
            "normalized_username = lower(normalized_username)",
            name=op.f("ck_user_profile_normalized_username_lowercase"),
        ),
        sa.ForeignKeyConstraint(
            ["identity_id"],
            ["university_identity.id"],
            name=op.f("fk_user_profile_identity_id_university_identity"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_user_profile_university_id_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_profile")),
        sa.UniqueConstraint("identity_id", name=op.f("uq_user_profile_identity_id")),
        sa.UniqueConstraint(
            "university_id",
            "normalized_username",
            name="uq_user_profile_university_username",
        ),
    )
    op.create_index(
        op.f("ix_user_profile_university_id"),
        "user_profile",
        ["university_id"],
    )
    op.create_table(
        "role_assignment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "participant",
                "building_admin",
                "platform_admin",
                name="role_kind",
            ),
            nullable=False,
        ),
        sa.Column("university_id", sa.Uuid(), nullable=True),
        sa.Column("building_id", sa.Uuid(), nullable=True),
        *timestamp_columns(),
        sa.CheckConstraint(
            "(role = 'platform_admin' AND university_id IS NULL AND "
            "building_id IS NULL) OR (role = 'participant' AND "
            "university_id IS NOT NULL AND building_id IS NULL) OR "
            "(role = 'building_admin' AND university_id IS NOT NULL AND "
            "building_id IS NOT NULL)",
            name=op.f("ck_role_assignment_role_scope"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["user_account.id"],
            name=op.f("fk_role_assignment_account_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_role_assignment_university_id_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_role_assignment")),
        sa.UniqueConstraint(
            "account_id",
            "role",
            "university_id",
            "building_id",
            name="uq_role_assignment_scope",
        ),
    )
    op.create_index(
        op.f("ix_role_assignment_account_id"),
        "role_assignment",
        ["account_id"],
    )
    op.create_index(
        op.f("ix_role_assignment_university_id"),
        "role_assignment",
        ["university_id"],
    )
    op.create_index(
        "ix_role_assignment_scope",
        "role_assignment",
        ["university_id", "building_id"],
    )
    op.create_table(
        "audit_event",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=True),
        sa.Column("actor_account_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column(
            "before_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "after_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("request_correlation_id", sa.String(length=100), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_account_id"],
            ["user_account.id"],
            name=op.f("fk_audit_event_actor_account_id_user_account"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_audit_event_university_id_university"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_event")),
    )
    op.create_index(
        op.f("ix_audit_event_actor_account_id"),
        "audit_event",
        ["actor_account_id"],
    )
    op.create_index(
        op.f("ix_audit_event_university_id"),
        "audit_event",
        ["university_id"],
    )


def downgrade() -> None:
    op.drop_table("audit_event")
    op.drop_index("ix_role_assignment_scope", table_name="role_assignment")
    op.drop_table("role_assignment")
    op.drop_table("user_profile")
    op.drop_table("university_identity")
    op.drop_table("university_email_domain")
    op.drop_table("user_account")
    op.drop_table("university")
    bind = op.get_bind()
    for enum_name in (
        "role_kind",
        "moderation_state",
        "enrollment_state",
        "account_status",
        "university_status",
    ):
        postgresql.ENUM(name=enum_name).drop(bind, checkfirst=True)
