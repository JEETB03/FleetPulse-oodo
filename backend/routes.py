import uuid
from datetime import datetime, date
from statistics import mean
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import (
    PermissionMatrix, PermissionLevel, User, Role, Vehicle, VehicleStatus, Driver, Trip, TripStatus,
    ServiceLogEntry, FuelLogEntry
)
from backend.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, PermissionChecker
)
from backend.services import (
    SafetyScoreEngine, DispatchEngine, MaintenanceEngine,
    FuelAnomalyEngine, ComplianceEngine, SustainabilityEngine
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class VehicleCreate(BaseModel):
    plate_no: str
    v_type: str
    odometer_km: float
    last_service_km: float
    last_service_date: date
    insurance_expiry: date
    status: Optional[VehicleStatus] = VehicleStatus.IDLE
    engine_hours: Optional[float] = 0.0

class VehicleUpdate(BaseModel):
    plate_no: Optional[str] = None
    v_type: Optional[str] = None
    odometer_km: Optional[float] = None
    last_service_km: Optional[float] = None
    last_service_date: Optional[date] = None
    insurance_expiry: Optional[date] = None
    status: Optional[VehicleStatus] = None
    engine_hours: Optional[float] = None

class DriverCreate(BaseModel):
    name: str
    license_no: str
    license_expiry: date
    violations: Optional[int] = 0
    hours_driven_7d: Optional[float] = 0.0
    linked_user_id: Optional[str] = None

class TripCreate(BaseModel):
    origin: str
    destination: str
    scheduled_start: datetime
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None

class AssignPayload(BaseModel):
    vehicle_id: str
    driver_id: str

class CompletePayload(BaseModel):
    distance_km: float

class FuelLogCreate(BaseModel):
    vehicle_id: str
    date: date
    odometer_km: float
    liters: float
    cost: float

class ServiceLogCreate(BaseModel):
    vehicle_id: str
    date: date
    description: str
    cost: float
    odometer_km: float

class PermissionMatrixItem(BaseModel):
    module: str
    admin: PermissionLevel
    manager: PermissionLevel
    dispatcher: PermissionLevel
    safety: PermissionLevel
    finance: PermissionLevel
    driver: PermissionLevel

class PermissionMatrixPayload(BaseModel):
    permissions: List[PermissionMatrixItem]

class UserListItem(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role

# ---------------------------------------------------------------------------
# Authentication Routes
# ---------------------------------------------------------------------------

@router.post("/auth/signup", response_model=TokenResponse)
def signup(payload: UserSignup, session: Session = Depends(get_session)):
    # Check if user already exists
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    
    new_user = User(
        id=str(uuid.uuid4())[:8],
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=payload.role
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email, "role": new_user.role}
    }

@router.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }

# Endpoint for standard oauth2 form submission if needed (Vite will use the JSON post above mostly)
@router.post("/auth/token", response_model=TokenResponse)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    }

@router.get("/users", response_model=List[UserListItem])
def list_users(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin credentials required")

    users = session.exec(select(User).order_by(User.created_at.asc())).all()
    return users

@router.get("/settings/permissions", response_model=List[PermissionMatrix])
def list_permissions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    permissions = session.exec(select(PermissionMatrix).order_by(PermissionMatrix.module.asc())).all()
    return permissions

@router.put("/settings/permissions", response_model=List[PermissionMatrix])
def update_permissions(
    payload: PermissionMatrixPayload,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin credentials required")

    updated_rows: list[PermissionMatrix] = []
    for item in payload.permissions:
        row = session.get(PermissionMatrix, item.module)
        if row is None:
            row = PermissionMatrix(module=item.module)

        row.admin = item.admin
        row.manager = item.manager
        row.dispatcher = item.dispatcher
        row.safety = item.safety
        row.finance = item.finance
        row.driver = item.driver
        row.updated_at = datetime.utcnow()

        session.add(row)
        updated_rows.append(row)

    session.commit()

    for row in updated_rows:
        session.refresh(row)

    return updated_rows

# ---------------------------------------------------------------------------
# Vehicle Routes
# ---------------------------------------------------------------------------

@router.get("/vehicles", response_model=List[Vehicle])
def get_vehicles(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Anyone authenticated can read
    return session.exec(select(Vehicle)).all()

@router.post("/vehicles", response_model=Vehicle)
def create_vehicle(
    payload: VehicleCreate,
    current_user: User = Depends(PermissionChecker("vehicles", requires_write=True)),
    session: Session = Depends(get_session)
):
    # Check duplicate plate number
    existing = session.exec(select(Vehicle).where(Vehicle.plate_no == payload.plate_no)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle with plate number {payload.plate_no} already exists."
        )

    new_v = Vehicle(
        id=str(uuid.uuid4())[:8],
        plate_no=payload.plate_no,
        v_type=payload.v_type,
        odometer_km=payload.odometer_km,
        last_service_km=payload.last_service_km,
        last_service_date=payload.last_service_date,
        insurance_expiry=payload.insurance_expiry,
        status=payload.status,
        engine_hours=payload.engine_hours
    )
    session.add(new_v)
    session.commit()
    session.refresh(new_v)
    return new_v

@router.patch("/vehicles/{id}", response_model=Vehicle)
def update_vehicle(
    id: str,
    payload: VehicleUpdate,
    current_user: User = Depends(PermissionChecker("vehicles", requires_write=True)),
    session: Session = Depends(get_session)
):
    v = session.get(Vehicle, id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(v, key, value)
        
    session.add(v)
    session.commit()
    session.refresh(v)
    return v

@router.get("/vehicles/{id}/history")
def get_vehicle_history(
    id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    v = session.get(Vehicle, id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    fuel_logs = session.exec(
        select(FuelLogEntry).where(FuelLogEntry.vehicle_id == id).order_by(FuelLogEntry.date.desc())
    ).all()
    
    service_logs = session.exec(
        select(ServiceLogEntry).where(ServiceLogEntry.vehicle_id == id).order_by(ServiceLogEntry.date.desc())
    ).all()
    
    trips = session.exec(
        select(Trip).where(Trip.vehicle_id == id).order_by(Trip.scheduled_start.desc())
    ).all()
    
    return {
        "vehicle": v,
        "fuel_logs": fuel_logs,
        "service_logs": service_logs,
        "trips": trips
    }

# ---------------------------------------------------------------------------
# Driver Routes
# ---------------------------------------------------------------------------

@router.get("/drivers")
def get_drivers(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    drivers = session.exec(select(Driver)).all()
    res = []
    for d in drivers:
        score = SafetyScoreEngine.score(d)
        res.append({
            "id": d.id,
            "name": d.name,
            "license_no": d.license_no,
            "license_expiry": d.license_expiry,
            "violations": d.violations,
            "trips_completed": d.trips_completed,
            "hours_driven_7d": d.hours_driven_7d,
            "last_trip_end": d.last_trip_end,
            "linked_user_id": d.linked_user_id,
            "safety_score": score,
            "safety_badge": SafetyScoreEngine.badge(score)
        })
    return res

@router.post("/drivers", response_model=Driver)
def create_driver(
    payload: DriverCreate,
    current_user: User = Depends(PermissionChecker("drivers", requires_write=True)),
    session: Session = Depends(get_session)
):
    new_d = Driver(
        id=str(uuid.uuid4())[:8],
        name=payload.name,
        license_no=payload.license_no,
        license_expiry=payload.license_expiry,
        violations=payload.violations,
        hours_driven_7d=payload.hours_driven_7d,
        linked_user_id=payload.linked_user_id
    )
    session.add(new_d)
    session.commit()
    session.refresh(new_d)
    return new_d

# ---------------------------------------------------------------------------
# Trip Routes
# ---------------------------------------------------------------------------

@router.get("/trips", response_model=List[Trip])
def get_trips(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(select(Trip)).all()

@router.post("/trips", response_model=Trip)
def create_trip(
    payload: TripCreate,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    trip = Trip(
        id=str(uuid.uuid4())[:8],
        origin=payload.origin,
        destination=payload.destination,
        scheduled_start=payload.scheduled_start,
        status=TripStatus.ASSIGNED
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)

    # Perform assignment if requested
    if payload.vehicle_id and payload.driver_id:
        try:
            trip = DispatchEngine.assign_trip(session, trip, payload.vehicle_id, payload.driver_id)
        except ValueError as e:
            # Delete trip and throw error if assignment fails
            session.delete(trip)
            session.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
            
    return trip

@router.post("/trips/{id}/assign", response_model=Trip)
def assign_trip(
    id: str,
    payload: AssignPayload,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    trip = session.get(Trip, id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    try:
        updated_trip = DispatchEngine.assign_trip(session, trip, payload.vehicle_id, payload.driver_id)
        return updated_trip
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/auto-assign", response_model=Trip)
def auto_assign_trip(
    id: str,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    trip = session.get(Trip, id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    try:
        updated_trip = DispatchEngine.auto_assign_trip(session, trip)
        return updated_trip
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/complete", response_model=Trip)
def complete_trip(
    id: str,
    payload: CompletePayload,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    try:
        return DispatchEngine.complete_trip(session, id, payload.distance_km)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/start", response_model=Trip)
def start_trip(
    id: str,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    try:
        return DispatchEngine.start_trip(session, id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/delay", response_model=Trip)
def delay_trip(
    id: str,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    try:
        return DispatchEngine.delay_trip(session, id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/cancel", response_model=Trip)
def cancel_trip(
    id: str,
    current_user: User = Depends(PermissionChecker("dispatch", requires_write=True)),
    session: Session = Depends(get_session)
):
    try:
        return DispatchEngine.cancel_trip(session, id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ---------------------------------------------------------------------------
# Maintenance Routes
# ---------------------------------------------------------------------------

@router.get("/maintenance/upcoming")
def get_upcoming_services(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Anyone authenticated can read
    vehicles = session.exec(select(Vehicle)).all()
    return MaintenanceEngine.upcoming_service_list(vehicles)

@router.post("/maintenance/log", response_model=ServiceLogEntry)
def log_service(
    payload: ServiceLogCreate,
    current_user: User = Depends(PermissionChecker("maintenance", requires_write=True)),
    session: Session = Depends(get_session)
):
    vehicle = session.get(Vehicle, payload.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    # Log Service entry
    entry = ServiceLogEntry(
        id=str(uuid.uuid4())[:8],
        vehicle_id=payload.vehicle_id,
        date=payload.date,
        description=payload.description,
        cost=payload.cost,
        odometer_km=payload.odometer_km
    )
    session.add(entry)
    
    # Update Vehicle counters
    vehicle.last_service_km = payload.odometer_km
    vehicle.last_service_date = payload.date
    if payload.odometer_km > vehicle.odometer_km:
        vehicle.odometer_km = payload.odometer_km
        
    # Reset vehicle status from In Shop to Active if it was in shop
    if vehicle.status == VehicleStatus.IN_SHOP:
        vehicle.status = VehicleStatus.ACTIVE
        
    session.add(vehicle)
    session.commit()
    session.refresh(entry)
    return entry

# ---------------------------------------------------------------------------
# Fuel Routes
# ---------------------------------------------------------------------------

@router.get("/fuel", response_model=List[FuelLogEntry])
def get_fuel_logs(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(select(FuelLogEntry).order_by(FuelLogEntry.date.desc())).all()

@router.post("/fuel/log", response_model=FuelLogEntry)
def log_fuel(
    payload: FuelLogCreate,
    current_user: User = Depends(PermissionChecker("fuel_expense", requires_write=True)),
    session: Session = Depends(get_session)
):
    vehicle = session.get(Vehicle, payload.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    entry = FuelLogEntry(
        id=str(uuid.uuid4())[:8],
        vehicle_id=payload.vehicle_id,
        date=payload.date,
        odometer_km=payload.odometer_km,
        liters=payload.liters,
        cost=payload.cost
    )
    session.add(entry)
    
    # Update odometer if higher
    if payload.odometer_km > vehicle.odometer_km:
        vehicle.odometer_km = payload.odometer_km
        
    session.add(vehicle)
    session.commit()
    session.refresh(entry)
    return entry

@router.get("/fuel/anomalies")
def get_fuel_anomalies(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    logs = session.exec(select(FuelLogEntry)).all()
    return FuelAnomalyEngine.detect_anomalies(logs)

# ---------------------------------------------------------------------------
# Analytics Routes
# ---------------------------------------------------------------------------

@router.get("/analytics/dashboard")
def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    vehicles = session.exec(select(Vehicle)).all()
    drivers = session.exec(select(Driver)).all()
    trips = session.exec(select(Trip)).all()
    fuel_logs = session.exec(select(FuelLogEntry)).all()
    service_logs = session.exec(select(ServiceLogEntry)).all()

    # Counts by status
    vehicle_counts = {status.value: 0 for status in VehicleStatus}
    for v in vehicles:
        vehicle_counts[v.status.value] += 1

    # Active trips (assigned/in transit)
    active_trips_count = sum(1 for t in trips if t.status in [TripStatus.ASSIGNED, TripStatus.IN_TRANSIT])

    # Alerts & anomalies
    compliance_alerts = ComplianceEngine.insurance_alerts(vehicles)
    fuel_anomalies = FuelAnomalyEngine.detect_anomalies(fuel_logs)

    return {
        "vehicle_counts": vehicle_counts,
        "total_vehicles": len(vehicles),
        "total_drivers": len(drivers),
        "total_trips": len(trips),
        "active_trips_count": active_trips_count,
        "compliance_alerts": compliance_alerts,
        "fuel_anomalies": fuel_anomalies
    }

@router.get("/analytics/reports")
def get_reports_analytics(
    current_user: User = Depends(PermissionChecker("reports", requires_write=False)),
    session: Session = Depends(get_session)
):
    vehicles = session.exec(select(Vehicle)).all()
    trips = session.exec(select(Trip)).all()
    fuel_logs = session.exec(select(FuelLogEntry)).all()
    service_logs = session.exec(select(ServiceLogEntry)).all()

    # Fleet uptime %
    if not vehicles:
        uptime_pct = 0.0
    else:
        in_shop_count = sum(1 for v in vehicles if v.status == VehicleStatus.IN_SHOP)
        uptime_pct = round(((len(vehicles) - in_shop_count) / len(vehicles)) * 100.0, 1)

    # Average fuel efficiency km/L across all vehicles
    # Group fuel logs by vehicle
    by_vehicle = {}
    for f in fuel_logs:
        by_vehicle.setdefault(f.vehicle_id, []).append(f)
        
    efficiencies = []
    for vid, entries in by_vehicle.items():
        if len(entries) < 2:
            continue
        sorted_entries = sorted(entries, key=lambda e: e.odometer_km)
        km = sorted_entries[-1].odometer_km - sorted_entries[0].odometer_km
        liters = sum(e.liters for e in sorted_entries[1:])
        if liters > 0:
            efficiencies.append(km / liters)
            
    avg_efficiency = round(mean(efficiencies), 2) if efficiencies else 0.0

    # Total Operating cost
    total_fuel_cost = sum(f.cost for f in fuel_logs)
    total_service_cost = sum(s.cost for s in service_logs)
    total_cost = total_fuel_cost + total_service_cost

    # CO2 Estimate
    total_liters = sum(f.liters for f in fuel_logs)
    co2_kg = SustainabilityEngine.co2_estimate_kg(total_liters)

    # Trip completion metrics
    total_trips = len(trips)
    completed_trips = sum(1 for t in trips if t.status == TripStatus.COMPLETED)
    cancelled_trips = sum(1 for t in trips if t.status == TripStatus.CANCELLED)
    on_time_pct = round((completed_trips / (total_trips - cancelled_trips)) * 100.0, 1) if (total_trips - cancelled_trips) > 0 else 0.0

    # Top cost vehicles
    cost_by_vehicle = {}
    for v in vehicles:
        cost_by_vehicle[v.plate_no] = 0.0
        
    for f in fuel_logs:
        v = session.get(Vehicle, f.vehicle_id)
        if v:
            cost_by_vehicle[v.plate_no] = cost_by_vehicle.get(v.plate_no, 0.0) + f.cost
            
    for s in service_logs:
        v = session.get(Vehicle, s.vehicle_id)
        if v:
            cost_by_vehicle[v.plate_no] = cost_by_vehicle.get(v.plate_no, 0.0) + s.cost
            
    top_cost_vehicles = sorted(
        [{"plate_no": k, "cost": v} for k, v in cost_by_vehicle.items()],
        key=lambda x: -x["cost"]
    )[:5]

    return {
        "avg_fuel_efficiency": avg_efficiency,
        "fleet_uptime_pct": uptime_pct,
        "total_operating_cost": total_cost,
        "on_time_trip_pct": on_time_pct,
        "co2_estimate_kg": co2_kg,
        "total_liters": total_liters,
        "top_cost_vehicles": top_cost_vehicles,
        "total_trips": total_trips
    }
