"""Alembic environment for the platform-owned database."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from platform_app.modules.identity import models as identity_models
from platform_app.modules.ingestion import models as ingestion_models
from platform_app.modules.topology import models as topology_models
from platform_app.persistence import Base
from platform_app.settings import PlatformDatabaseSettings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", PlatformDatabaseSettings().database_url)
target_metadata = Base.metadata

assert identity_models is not None
assert ingestion_models is not None
assert topology_models is not None


def run_migrations_offline() -> None:
    """Run migrations without opening a database connection."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the configured platform database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
