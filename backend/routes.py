import os
import shutil
import uuid
from datetime import datetime, date
from statistics import mean
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import (
    PermissionMatrix, PermissionLevel, User, Role, Vehicle, VehicleStatus, Driver, Trip, TripStatus,
    ServiceLogEntry, FuelLogEntry, Notification, NotificationTag
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

class DriverSelfCreate(BaseModel):
    name: str
    license_no: str
    license_expiry: date

class FuelLogCreate(BaseModel):
    vehicle_id: str
    date: date
    odometer_km: float
    liters: float
    cost: float
    receipt_url: Optional[str] = None

class ServiceLogCreate(BaseModel):
    vehicle_id: str
    date: date
    description: str
    cost: float
    odometer_km: float
    receipt_url: Optional[str] = None

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

class NotificationCreate(BaseModel):
    tag: NotificationTag
    description: str
    location: str

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

@router.get("/drivers/me")
def get_driver_me(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    score = SafetyScoreEngine.score(driver)
    return {
        "id": driver.id,
        "name": driver.name,
        "license_no": driver.license_no,
        "license_expiry": driver.license_expiry,
        "violations": driver.violations,
        "trips_completed": driver.trips_completed,
        "hours_driven_7d": driver.hours_driven_7d,
        "last_trip_end": driver.last_trip_end,
        "linked_user_id": driver.linked_user_id,
        "safety_score": score,
        "safety_badge": SafetyScoreEngine.badge(score)
    }

@router.post("/drivers/me", response_model=Driver)
def create_driver_me(
    payload: DriverSelfCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role != Role.DRIVER:
        raise HTTPException(status_code=400, detail="Only users with Driver role can create driver profiles.")
        
    existing = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
    if existing:
        existing.name = payload.name
        existing.license_no = payload.license_no
        existing.license_expiry = payload.license_expiry
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
        
    new_d = Driver(
        id=str(uuid.uuid4())[:8],
        name=payload.name,
        license_no=payload.license_no,
        license_expiry=payload.license_expiry,
        violations=0,
        trips_completed=0,
        hours_driven_7d=0.0,
        linked_user_id=current_user.id
    )
    session.add(new_d)
    session.commit()
    session.refresh(new_d)
    return new_d

@router.post("/expenses/upload")
def upload_expense_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    filepath = os.path.join(uploads_dir, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"receipt_url": f"/uploads/{filename}"}

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
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    trip = session.get(Trip, id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
    is_assigned_driver = driver and trip.driver_id == driver.id
    is_dispatch_staff = current_user.role in [Role.ADMIN, Role.FLEET_MANAGER, Role.DISPATCHER]
    
    if not (is_assigned_driver or is_dispatch_staff):
        raise HTTPException(status_code=403, detail="Not authorized to complete this trip")
        
    try:
        return DispatchEngine.complete_trip(session, id, payload.distance_km)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/start", response_model=Trip)
def start_trip(
    id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    trip = session.get(Trip, id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
    is_assigned_driver = driver and trip.driver_id == driver.id
    is_dispatch_staff = current_user.role in [Role.ADMIN, Role.FLEET_MANAGER, Role.DISPATCHER]
    
    if not (is_assigned_driver or is_dispatch_staff):
        raise HTTPException(status_code=403, detail="Not authorized to start this trip")
        
    try:
        return DispatchEngine.start_trip(session, id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/trips/{id}/refuse", response_model=Trip)
def refuse_trip(
    id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    trip = session.get(Trip, id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
    is_assigned_driver = driver and trip.driver_id == driver.id
    is_dispatch_staff = current_user.role in [Role.ADMIN, Role.FLEET_MANAGER, Role.DISPATCHER]
    
    if not (is_assigned_driver or is_dispatch_staff):
        raise HTTPException(status_code=403, detail="Not authorized to refuse this trip")
        
    if trip.status != TripStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Can only refuse trips in Assigned status.")
        
    if trip.vehicle_id:
        vehicle = session.get(Vehicle, trip.vehicle_id)
        if vehicle and vehicle.status == VehicleStatus.ON_TRIP:
            vehicle.status = VehicleStatus.IDLE
            session.add(vehicle)
            
    trip.driver_id = None
    trip.vehicle_id = None
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip

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
        odometer_km=payload.odometer_km,
        receipt_url=payload.receipt_url
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
        cost=payload.cost,
        receipt_url=payload.receipt_url
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

@router.get("/notifications", response_model=List[Notification])
def get_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(select(Notification).order_by(Notification.created_at.desc())).all()

@router.post("/notifications", response_model=Notification, status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: NotificationCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role != Role.DRIVER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only drivers can submit notifications")

    driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
    driver_id = driver.id if driver else current_user.id
    driver_name = driver.name if driver else current_user.name

    notification = Notification(
        id=str(uuid.uuid4())[:8],
        driver_id=driver_id,
        driver_name=driver_name,
        tag=payload.tag,
        description=payload.description,
        location=payload.location,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification

@router.get("/analytics/dashboard")
def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role == Role.DRIVER:
        driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
        if not driver:
            return {
                "role": "Driver",
                "has_profile": False,
                "message": "Please create your driver profile."
            }
        
        # Get active trip (Assigned, In Transit, Delayed)
        active_trip = session.exec(select(Trip).where(
            Trip.driver_id == driver.id,
            Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_TRANSIT, TripStatus.DELAYED])
        )).first()
        
        # Get vehicle
        vehicle = None
        if active_trip and active_trip.vehicle_id:
            vehicle = session.get(Vehicle, active_trip.vehicle_id)
        else:
            last_trip = session.exec(select(Trip).where(
                Trip.driver_id == driver.id,
                Trip.status == TripStatus.COMPLETED
            ).order_by(Trip.scheduled_start.desc())).first()
            if last_trip and last_trip.vehicle_id:
                vehicle = session.get(Vehicle, last_trip.vehicle_id)
                
        vehicle_stats = None
        compliance_alerts = []
        fuel_anomalies = []
        if vehicle:
            risk_score = MaintenanceEngine.risk_score(vehicle)
            urgency = MaintenanceEngine.urgency_tag(vehicle)
            days_left = (vehicle.insurance_expiry - date.today()).days
            vehicle_stats = {
                "id": vehicle.id,
                "plate_no": vehicle.plate_no,
                "v_type": vehicle.v_type,
                "odometer_km": vehicle.odometer_km,
                "last_service_km": vehicle.last_service_km,
                "last_service_date": vehicle.last_service_date,
                "insurance_expiry": vehicle.insurance_expiry,
                "days_left": days_left,
                "status": vehicle.status,
                "engine_hours": vehicle.engine_hours,
                "risk_score": risk_score,
                "urgency": urgency
            }
            compliance_alerts = ComplianceEngine.insurance_alerts([vehicle])
            
            all_fuel_logs = session.exec(select(FuelLogEntry)).all()
            fuel_anomalies = [a for a in FuelAnomalyEngine.detect_anomalies(all_fuel_logs) if a["vehicle_id"] == vehicle.id]
            
        score = SafetyScoreEngine.score(driver)
        badge = SafetyScoreEngine.badge(score)
        
        return {
            "role": "Driver",
            "has_profile": True,
            "driver": {
                "id": driver.id,
                "name": driver.name,
                "license_no": driver.license_no,
                "license_expiry": driver.license_expiry,
                "violations": driver.violations,
                "trips_completed": driver.trips_completed,
                "hours_driven_7d": driver.hours_driven_7d,
                "safety_score": score,
                "safety_badge": badge
            },
            "active_trip": active_trip,
            "vehicle": vehicle_stats,
            "compliance_alerts": compliance_alerts,
            "fuel_anomalies": fuel_anomalies
        }

    vehicles = session.exec(select(Vehicle)).all()
    drivers = session.exec(select(Driver)).all()
    trips = session.exec(select(Trip)).all()
    fuel_logs = session.exec(select(FuelLogEntry)).all()
    service_logs = session.exec(select(ServiceLogEntry)).all()
    notifications = session.exec(select(Notification)).all()

    # Counts by status
    vehicle_counts = {status.value: 0 for status in VehicleStatus}
    for v in vehicles:
        vehicle_counts[v.status.value] += 1

    # Active trips (assigned/in transit)
    active_trips_count = sum(1 for t in trips if t.status in [TripStatus.ASSIGNED, TripStatus.IN_TRANSIT])

    # Alerts & anomalies
    compliance_alerts = ComplianceEngine.insurance_alerts(vehicles)
    fuel_anomalies = FuelAnomalyEngine.detect_anomalies(fuel_logs)
    severe_notifications = [n for n in notifications if n.tag == NotificationTag.RED][:10]

    return {
        "vehicle_counts": vehicle_counts,
        "total_vehicles": len(vehicles),
        "total_drivers": len(drivers),
        "total_trips": len(trips),
        "active_trips_count": active_trips_count,
        "compliance_alerts": compliance_alerts,
        "fuel_anomalies": fuel_anomalies,
        "severe_notifications": severe_notifications
    }

@router.get("/analytics/reports")
def get_reports_analytics(
    current_user: User = Depends(PermissionChecker("reports", requires_write=False)),
    session: Session = Depends(get_session)
):
    if current_user.role == Role.DRIVER:
        driver = session.exec(select(Driver).where(Driver.linked_user_id == current_user.id)).first()
        if not driver:
            return {
                "role": "Driver",
                "has_profile": False,
                "message": "Please create driver profile."
            }
            
        driver_trips = session.exec(select(Trip).where(Trip.driver_id == driver.id)).all()
        total_trips = len(driver_trips)
        completed_trips_count = sum(1 for t in driver_trips if t.status == TripStatus.COMPLETED)
        cancelled_trips_count = sum(1 for t in driver_trips if t.status == TripStatus.CANCELLED)
        
        on_time_pct = round((completed_trips_count / (total_trips - cancelled_trips_count)) * 100.0, 1) if (total_trips - cancelled_trips_count) > 0 else 0.0
        
        v_ids = list({t.vehicle_id for t in driver_trips if t.vehicle_id})
        total_distance = sum(t.distance_km for t in driver_trips if t.distance_km)
        
        total_cost = 0.0
        total_liters = 0.0
        efficiencies = []
        
        if v_ids:
            fuel_logs = session.exec(select(FuelLogEntry).where(FuelLogEntry.vehicle_id.in_(v_ids))).all()
            service_logs = session.exec(select(ServiceLogEntry).where(ServiceLogEntry.vehicle_id.in_(v_ids))).all()
            
            total_fuel_cost = sum(f.cost for f in fuel_logs)
            total_service_cost = sum(s.cost for s in service_logs)
            total_cost = total_fuel_cost + total_service_cost
            total_liters = sum(f.liters for f in fuel_logs)
            
            by_vehicle = {}
            for f in fuel_logs:
                by_vehicle.setdefault(f.vehicle_id, []).append(f)
            for vid, entries in by_vehicle.items():
                if len(entries) < 2:
                    continue
                sorted_entries = sorted(entries, key=lambda e: e.odometer_km)
                km = sorted_entries[-1].odometer_km - sorted_entries[0].odometer_km
                liters = sum(e.liters for e in sorted_entries[1:])
                if liters > 0:
                    efficiencies.append(km / liters)
                    
        avg_efficiency = round(mean(efficiencies), 2) if efficiencies else 0.0
        co2_kg = SustainabilityEngine.co2_estimate_kg(total_liters)
        safety_score = SafetyScoreEngine.score(driver)
        
        return {
            "role": "Driver",
            "has_profile": True,
            "avg_fuel_efficiency": avg_efficiency,
            "total_operating_cost": total_cost,
            "on_time_trip_pct": on_time_pct,
            "co2_estimate_kg": co2_kg,
            "total_liters": total_liters,
            "total_trips": total_trips,
            "safety_score": safety_score,
            "total_distance_km": total_distance,
            "top_cost_vehicles": []
        }

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

# ---------------------------------------------------------------------------
# Weather Forecast Routes
# ---------------------------------------------------------------------------

import hashlib

def generate_mock_weather(city: str, date_val: str):
    seed_str = f"{city.strip().lower()}-{date_val}"
    h = int(hashlib.md5(seed_str.encode('utf-8')).hexdigest(), 16)
    
    conditions = [
        ("Sunny", 30, "Low", "Clear skies, optimal driving visibility."),
        ("Partly Cloudy", 27, "Low", "Good driving conditions, mild cloud cover."),
        ("Overcast", 23, "Low", "Dry roads, overcast skies."),
        ("Windy", 22, "Medium", "High wind gusts. Keep firm grip on steering wheel."),
        ("Foggy", 16, "Medium", "Reduced visibility. Engage fog lamps and reduce speed."),
        ("Light Rain", 20, "Medium", "Wet surfaces. Reduce speed around sharp bends."),
        ("Heavy Rain", 18, "High", "Hydroplaning hazard. Increase braking distance by 2x."),
        ("Thunderstorm", 17, "High", "Severe storm alert. Avoid parking under trees or power lines.")
    ]
    
    idx = h % len(conditions)
    cond, temp, hazard, advisory = conditions[idx]
    
    temp_adjust = (h % 9) - 4
    final_temp = temp + temp_adjust
    
    return {
        "city": city,
        "date": date_val,
        "condition": cond,
        "temperature": final_temp,
        "hazard_level": hazard,
        "advisory": advisory
    }

@router.get("/weather")
def get_route_weather(
    origin: str,
    destination: str,
    scheduled_date: str,
    current_user: User = Depends(get_current_user)
):
    if not origin or not destination:
        raise HTTPException(status_code=400, detail="Origin and destination are required.")
    
    # Extract only date part if datetime string is passed
    date_val = scheduled_date.split('T')[0] if 'T' in scheduled_date else scheduled_date
    
    origin_weather = generate_mock_weather(origin, date_val)
    dest_weather = generate_mock_weather(destination, date_val)
    
    hazard_map = {"Low": 1, "Medium": 2, "High": 3}
    max_hazard_val = max(hazard_map[origin_weather["hazard_level"]], hazard_map[dest_weather["hazard_level"]])
    route_hazard = "Low"
    if max_hazard_val == 2:
        route_hazard = "Medium"
    elif max_hazard_val == 3:
        route_hazard = "High"
        
    recommendations = []
    if route_hazard == "High":
        recommendations.append("Dispatch warning: Severe weather en route. Postpone trip if driving visibility is critically low.")
    elif route_hazard == "Medium":
        recommendations.append("Weather alert: Moderate caution advised. Wet or foggy roads expected.")
    else:
        recommendations.append("Clear route ahead. Proceed with standard dispatch schedule.")
        
    return {
        "origin": origin_weather,
        "destination": dest_weather,
        "route_hazard_level": route_hazard,
        "recommendations": recommendations
    }
