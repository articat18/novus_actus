"""Acceptance tests for the reproducible service foundation."""

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import FastAPI
from pydantic import AnyHttpUrl, ValidationError

from platform_app import create_app as create_platform_app
from platform_app.settings import PlatformSettings
from pseudo_university_app import create_app as create_university_app
from pseudo_university_app.settings import PseudoUniversitySettings


def test_both_application_packages_import_and_build() -> None:
    platform_settings = PlatformSettings(
        database_url="postgresql+psycopg://example/platform",
        university_api_url=AnyHttpUrl("https://university.example.test"),
    )
    university_settings = PseudoUniversitySettings(
        database_url="postgresql+psycopg://example/university"
    )

    platform_app = create_platform_app(platform_settings)
    university_app = create_university_app(university_settings)

    assert isinstance(platform_app, FastAPI)
    assert platform_app.title == "Energy Leaderboard Platform"
    assert isinstance(university_app, FastAPI)
    assert university_app.title == "Pseudo University Verification"


def test_platform_configuration_rejects_missing_required_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PLATFORM_DATABASE_URL", raising=False)
    monkeypatch.delenv("PLATFORM_UNIVERSITY_API_URL", raising=False)

    with pytest.raises(ValidationError) as error:
        PlatformSettings()

    missing_fields = {item["loc"] for item in error.value.errors()}
    assert missing_fields == {("database_url",), ("university_api_url",)}


def test_university_configuration_rejects_missing_database_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PSEUDO_UNIVERSITY_DATABASE_URL", raising=False)

    with pytest.raises(ValidationError) as error:
        PseudoUniversitySettings()

    assert [item["loc"] for item in error.value.errors()] == [("database_url",)]


@pytest.mark.parametrize(
    ("config_path", "expected_heads"),
    [
        ("migrations/platform.ini", ["20260829_0001"]),
        ("migrations/pseudo_university.ini", ["20260829_uni_0001"]),
    ],
)
def test_migration_entry_point_is_discoverable(
    config_path: str, expected_heads: list[str]
) -> None:
    script = ScriptDirectory.from_config(Config(config_path))

    assert script.get_heads() == expected_heads
