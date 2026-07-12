import os
from sqlmodel import SQLModel, create_engine, Session

# Use local sqlite db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fleetpulse.db")

# connect_args={"check_same_thread": False} is required for SQLite
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
