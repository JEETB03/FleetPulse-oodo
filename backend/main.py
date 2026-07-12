import os
import sys

# Ensure parent directory is in sys.path to allow running as script directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import create_db_and_tables
from backend.seed import seed_database
from backend.routes import router

app = FastAPI(
    title="FleetPulse API",
    description="Backend API for the FleetPulse Operations Management Platform",
    version="1.0.0"
)

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For demo / docker development simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # Make sure tables are created
    create_db_and_tables()
    # Check if database needs seeding
    seed_database()

@app.get("/")
def read_root():
    return {"status": "online", "message": "FleetPulse API is running"}

app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
