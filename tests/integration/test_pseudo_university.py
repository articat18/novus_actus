"""REQ-UNI-001 isolated service, migration, API, and consumer contract tests."""

import ast
import os
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from platform_app.adapters.university_http import HttpUniversityVerificationClient
from platform_app.modules.university.contracts import VerificationStatus
from platform_app.persistence import Base as PlatformBase
from pseudo_university_app import create_app
from pseudo_university_app.persistence import Base as UniversityBase
from pseudo_university_app.persistence import models as roster_models
from pseudo_university_app.seed import seed_demo_roster
from pseudo_university_app.settings import PseudoUniversitySettings

pytestmark = pytest.mark.integration
VERIFICATION_TIME = datetime(2026, 8, 29, 0, 0, tzinfo=UTC)


@pytest.fixture(scope="module")
def university_engine() -> Iterator[Engine]:
    database_url = os.getenv("TEST_UNIVERSITY_DATABASE_URL")
    if database_url is None:
        pytest.skip(
            "TEST_UNIVERSITY_DATABASE_URL is required for university integration tests"
        )
    engine = create_engine(database_url)
    UniversityBase.metadata.drop_all(engine)
    UniversityBase.metadata.create_all(engine)
    with Session(engine) as session:
        seed_demo_roster(session)
        session.commit()
    yield engine
    UniversityBase.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def university_client(university_engine: Engine) -> Iterator[TestClient]:
    factory = sessionmaker(university_engine, class_=Session)
    settings = PseudoUniversitySettings(
        database_url="postgresql+psycopg://unused/university"
    )
    with TestClient(create_app(settings, factory)) as client:
        yield client


@pytest.mark.parametrize(
    ("email", "expected_status"),
    [
        ("ACTIVE@DEMO.EDU", "active"),
        ("inactive@demo.edu", "inactive"),
        ("unknown@demo.edu", "not_found"),
    ],
)
def test_verification_returns_active_inactive_and_no_match(
    university_client: TestClient, email: str, expected_status: str
) -> None:
    response = university_client.get(
        "/v1/verification/residents",
        params={"email": email, "at": VERIFICATION_TIME.isoformat()},
    )

    assert response.status_code == 200
    assert response.json()["status"] == expected_status
    if expected_status == "active":
        assert response.json()["residence"] == {
            "building_reference": "hall-1",
            "apartment_reference": "hall-1-a01",
            "room_reference": "hall-1-a01-r1",
            "source_version": "residence-v1",
        }
    else:
        assert response.json()["residence"] is None


def test_verification_api_is_read_only(university_client: TestClient) -> None:
    response = university_client.post(
        "/v1/verification/residents",
        params={"email": "active@demo.edu", "at": VERIFICATION_TIME.isoformat()},
    )

    assert response.status_code == 405


def test_platform_consumer_contract_accepts_service_payload() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/v1/verification/residents"
        return httpx2.Response(
            200,
            json={
                "status": "active",
                "university_reference": "demo-university",
                "student_reference": "student-active",
                "residence": {
                    "building_reference": "hall-1",
                    "apartment_reference": "hall-1-a01",
                    "room_reference": "hall-1-a01-r1",
                    "source_version": "residence-v1",
                },
            },
        )

    client = httpx2.Client(transport=httpx2.MockTransport(handler))
    adapter = HttpUniversityVerificationClient("https://university.test", client)

    result = adapter.verify_resident("active@demo.edu", VERIFICATION_TIME)

    assert result.status is VerificationStatus.ACTIVE
    assert result.residence is not None
    assert result.residence.apartment_reference == "hall-1-a01"


def test_seed_ids_are_deterministic() -> None:
    from pseudo_university_app.seed import seed_id

    assert seed_id(2026, "student-active") == seed_id(2026, "student-active")
    assert seed_id(2026, "student-active") != seed_id(2027, "student-active")


def test_platform_persistence_has_no_pseudo_university_import() -> None:
    platform_root = Path("src/platform_app")
    imported_modules: set[str] = set()
    for path in platform_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported_modules.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported_modules.add(node.module)

    assert UniversityBase.metadata is not PlatformBase.metadata
    assert roster_models is not None
    assert not any(
        module == "pseudo_university_app" or module.startswith("pseudo_university_app.")
        for module in imported_modules
    )
