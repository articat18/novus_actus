"""Declarative metadata owned by the pseudo-university database."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base for pseudo-university-owned SQLAlchemy mappings."""
