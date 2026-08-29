"""Add isolated pseudo-university roster.

Revision ID: 20260829_uni_0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260829_uni_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "roster_university",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("normalized_email_domain", sa.String(length=255), nullable=False),
        sa.CheckConstraint(
            "normalized_email_domain = lower(normalized_email_domain)",
            name=op.f("ck_roster_university_email_domain_lowercase"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roster_university")),
        sa.UniqueConstraint(
            "external_reference",
            name=op.f("uq_roster_university_external_reference"),
        ),
        sa.UniqueConstraint(
            "normalized_email_domain",
            name=op.f("uq_roster_university_normalized_email_domain"),
        ),
    )
    op.create_table(
        "roster_building",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["roster_university.id"],
            name=op.f("fk_roster_building_university_id_roster_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roster_building")),
        sa.UniqueConstraint(
            "university_id",
            "external_reference",
            name=op.f("uq_roster_building_university_id"),
        ),
    )
    op.create_table(
        "roster_apartment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("building_id", sa.Uuid(), nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(
            ["building_id"],
            ["roster_building.id"],
            name=op.f("fk_roster_apartment_building_id_roster_building"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roster_apartment")),
        sa.UniqueConstraint(
            "building_id",
            "external_reference",
            name=op.f("uq_roster_apartment_building_id"),
        ),
    )
    op.create_table(
        "roster_room",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("apartment_id", sa.Uuid(), nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(
            ["apartment_id"],
            ["roster_apartment.id"],
            name=op.f("fk_roster_room_apartment_id_roster_apartment"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roster_room")),
        sa.UniqueConstraint(
            "apartment_id",
            "external_reference",
            name=op.f("uq_roster_room_apartment_id"),
        ),
    )
    op.create_table(
        "student",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("university_id", sa.Uuid(), nullable=False),
        sa.Column("external_reference", sa.String(length=100), nullable=False),
        sa.Column("normalized_email", sa.String(length=320), nullable=False),
        sa.CheckConstraint(
            "normalized_email = lower(normalized_email)",
            name=op.f("ck_student_email_lowercase"),
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["roster_university.id"],
            name=op.f("fk_student_university_id_roster_university"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_student")),
        sa.UniqueConstraint(
            "university_id",
            "external_reference",
            name="uq_student_university_student_reference",
        ),
        sa.UniqueConstraint(
            "university_id",
            "normalized_email",
            name="uq_student_university_email",
        ),
    )
    op.create_table(
        "enrollment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("effective_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_version", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["student.id"],
            name=op.f("fk_enrollment_student_id_student"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_enrollment")),
    )
    op.create_index(op.f("ix_enrollment_student_id"), "enrollment", ["student_id"])
    op.create_table(
        "residence_assignment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("room_id", sa.Uuid(), nullable=False),
        sa.Column("effective_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_version", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["roster_room.id"],
            name=op.f("fk_residence_assignment_room_id_roster_room"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["student.id"],
            name=op.f("fk_residence_assignment_student_id_student"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_residence_assignment")),
    )
    op.create_index(
        op.f("ix_residence_assignment_student_id"),
        "residence_assignment",
        ["student_id"],
    )


def downgrade() -> None:
    op.drop_table("residence_assignment")
    op.drop_table("enrollment")
    op.drop_table("student")
    op.drop_table("roster_room")
    op.drop_table("roster_apartment")
    op.drop_table("roster_building")
    op.drop_table("roster_university")
