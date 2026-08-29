"""Replaceable outbound identity interfaces."""

from datetime import datetime
from typing import Protocol


class EmailCodeSender(Protocol):
    def send_code(self, email: str, code: str, expires_at: datetime) -> None:
        """Deliver a single-use university-email verification code."""


class InMemoryEmailCodeSender:
    """Demo adapter that retains codes in process without logging them."""

    def __init__(self) -> None:
        self._outbox: dict[str, tuple[str, datetime]] = {}

    def send_code(self, email: str, code: str, expires_at: datetime) -> None:
        self._outbox[email] = (code, expires_at)

    def code_for(self, email: str) -> str:
        return self._outbox[email][0]
