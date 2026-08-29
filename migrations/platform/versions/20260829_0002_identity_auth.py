"""Add passwordless identity and authorization records.

Revision ID: 20260829_0002
Revises: 20260829_0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260829_0002"
down_revision: str | None = "20260829_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "university",
        sa.Column("roster_reference", sa.String(length=100), nullable=True),
    )
    op.create_unique_constraint(
        op.f("uq_university_roster_reference"),
        "university",
        ["roster_reference"],
    )
    op.create_table(
        "email_challenge",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("normalized_email", sa.String(length=320), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_email_challenge_university_id_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_challenge")),
    )
    op.create_index(
        op.f("ix_email_challenge_normalized_email"),
        "email_challenge",
        ["normalized_email"],
    )
    op.create_index(
        op.f("ix_email_challenge_university_id"),
        "email_challenge",
        ["university_id"],
    )
    op.create_table(
        "access_session",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["user_account.id"],
            name=op.f("fk_access_session_account_id_user_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_access_session")),
        sa.UniqueConstraint(
            "token_digest", name=op.f("uq_access_session_token_digest")
        ),
    )
    op.create_index(
        op.f("ix_access_session_account_id"),
        "access_session",
        ["account_id"],
    )
    op.create_table(
        "verified_residence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("identity_id", sa.Uuid(), nullable=False),
        sa.Column("building_reference", sa.String(length=100), nullable=False),
        sa.Column("apartment_reference", sa.String(length=100), nullable=False),
        sa.Column("room_reference", sa.String(length=100), nullable=False),
        sa.Column("source_version", sa.String(length=100), nullable=False),
        sa.Column("effective_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["identity_id"],
            ["university_identity.id"],
            name=op.f("fk_verified_residence_identity_id_university_identity"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["university.id"],
            name=op.f("fk_verified_residence_university_id_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_verified_residence")),
    )
    op.create_index(
        op.f("ix_verified_residence_identity_id"),
        "verified_residence",
        ["identity_id"],
    )
    op.create_index(
        op.f("ix_verified_residence_university_id"),
        "verified_residence",
        ["university_id"],
    )
    op.create_index(
        "uq_role_assignment_effective_scope",
        "role_assignment",
        ["account_id", "role", "university_id", "building_id"],
        unique=True,
        postgresql_nulls_not_distinct=True,
    )


def downgrade() -> None:
    op.drop_index("uq_role_assignment_effective_scope", table_name="role_assignment")
    op.drop_table("verified_residence")
    op.drop_table("access_session")
    op.drop_table("email_challenge")
    op.drop_constraint(
        op.f("uq_university_roster_reference"), "university", type_="unique"
    )
    op.drop_column("university", "roster_reference")
