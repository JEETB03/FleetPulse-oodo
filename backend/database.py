import os
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session

# Use local sqlite db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fleetpulse.db")

# connect_args={"check_same_thread": False} is required for SQLite
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def ensure_compatible_schema():
    """Apply small additive schema fixes for older SQLite databases."""
    if not engine.url.get_backend_name().startswith("sqlite"):
        return

    required_columns = {
        "servicelogentry": {"receipt_url": "TEXT"},
        "fuellogentry": {"receipt_url": "TEXT"},
    }

    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in required_columns.items():
            if not inspector.has_table(table_name):
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))

def get_session():
    with Session(engine) as session:
        yield session
