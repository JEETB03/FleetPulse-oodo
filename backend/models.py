from datetime import datetime, date, timezone
from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship

class Role(str, Enum):
    ADMIN = "Admin"
    FLEET_MANAGER = "Fleet Manager"
    DISPATCHER = "Dispatcher"
    SAFETY_OFFICER = "Safety Officer"
    FINANCE_ANALYST = "Finance Analyst"
    DRIVER = "Driver"

class VehicleStatus(str, Enum):
    ACTIVE = "Active"
    ON_TRIP = "On Trip"
    IDLE = "Idle"
    IN_SHOP = "In Shop"
    RETIRED = "Retired"

class TripStatus(str, Enum):
    ASSIGNED = "Assigned"
    IN_TRANSIT = "In Transit"
    DELAYED = "Delayed"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class User(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: Role
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    driver: Optional["Driver"] = Relationship(back_populates="linked_user")

class Vehicle(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    plate_no: str = Field(unique=True, index=True)
    v_type: str  # Bus, Van, Truck
    odometer_km: float
    last_service_km: float
    last_service_date: date
    insurance_expiry: date
    status: VehicleStatus = Field(default=VehicleStatus.IDLE)
    engine_hours: float = Field(default=0.0)

    # Relationships
    trips: list["Trip"] = Relationship(back_populates="vehicle")
    service_logs: list["ServiceLogEntry"] = Relationship(back_populates="vehicle")
    fuel_logs: list["FuelLogEntry"] = Relationship(back_populates="vehicle")

class Driver(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    name: str
    license_no: str
    license_expiry: date
    violations: int = Field(default=0)
    trips_completed: int = Field(default=0)
    hours_driven_7d: float = Field(default=0.0)
    last_trip_end: Optional[datetime] = Field(default=None, nullable=True)
    linked_user_id: Optional[str] = Field(default=None, foreign_key="user.id", nullable=True)

    # Relationships
    linked_user: Optional[User] = Relationship(back_populates="driver")
    trips: list["Trip"] = Relationship(back_populates="driver")

class Trip(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    origin: str
    destination: str
    scheduled_start: datetime
    vehicle_id: Optional[str] = Field(default=None, foreign_key="vehicle.id", nullable=True)
    driver_id: Optional[str] = Field(default=None, foreign_key="driver.id", nullable=True)
    status: TripStatus = Field(default=TripStatus.ASSIGNED)
    distance_km: Optional[float] = Field(default=None, nullable=True)

    # Relationships
    vehicle: Optional[Vehicle] = Relationship(back_populates="trips")
    driver: Optional[Driver] = Relationship(back_populates="trips")

class ServiceLogEntry(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.id")
    date: date
    description: str
    cost: float
    odometer_km: float

    # Relationships
    vehicle: Vehicle = Relationship(back_populates="service_logs")

class FuelLogEntry(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    vehicle_id: str = Field(foreign_key="vehicle.id")
    date: date
    odometer_km: float
    liters: float
    cost: float

    # Relationships
    vehicle: Vehicle = Relationship(back_populates="fuel_logs")
