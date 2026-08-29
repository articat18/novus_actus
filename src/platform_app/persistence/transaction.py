"""Explicit transaction boundary used by application services."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.orm import Session


@contextmanager
def transaction(session: Session) -> Iterator[Session]:
    """Commit a complete use case or roll it back on any failure."""
    try:
        yield session
        session.commit()
    except BaseException:
        session.rollback()
        raise
