"""HTTP adapter for the university verification contract."""

from datetime import datetime

import httpx2

from platform_app.modules.university.contracts import UniversityVerification


class HttpUniversityVerificationClient:
    """Call a separately deployed read-only university API."""

    def __init__(self, base_url: str, client: httpx2.Client | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = client or httpx2.Client(timeout=5.0)

    def verify_resident(self, email: str, at: datetime) -> UniversityVerification:
        response = self._client.get(
            f"{self._base_url}/v1/verification/residents",
            params={"email": email, "at": at.isoformat()},
        )
        response.raise_for_status()
        return UniversityVerification.model_validate(response.json())
