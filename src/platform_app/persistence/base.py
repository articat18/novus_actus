"""Declarative metadata owned by the platform database."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base for platform-owned SQLAlchemy mappings."""
