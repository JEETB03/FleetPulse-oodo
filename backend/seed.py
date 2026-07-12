from datetime import datetime, date, timedelta
from sqlmodel import Session

from backend.database import engine
from backend.models import User, Role, Vehicle, VehicleStatus, Driver, Trip, TripStatus, FuelLogEntry, ServiceLogEntry
from backend.auth import get_password_hash

def seed_database():
    with Session(engine) as session:
        # Check if users already exist
        if session.query(User).first() is not None:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database with realistic FleetPulse data...")

        # 1. Create Users
        default_password = get_password_hash("password123")
        users = [
            User(id="usr-admin", name="Alex Carter", email="admin@fleetpulse.com", password_hash=default_password, role=Role.ADMIN),
            User(id="usr-fm", name="Sarah Jenkins", email="manager@fleetpulse.com", password_hash=default_password, role=Role.FLEET_MANAGER),
            User(id="usr-disp", name="Mike O'Connor", email="dispatcher@fleetpulse.com", password_hash=default_password, role=Role.DISPATCHER),
            User(id="usr-safety", name="Jessica Vance", email="safety@fleetpulse.com", password_hash=default_password, role=Role.SAFETY_OFFICER),
            User(id="usr-finance", name="David Kim", email="finance@fleetpulse.com", password_hash=default_password, role=Role.FINANCE_ANALYST),
            User(id="usr-driver", name="Robert Taylor", email="driver@fleetpulse.com", password_hash=default_password, role=Role.DRIVER),
        ]
        for u in users:
            session.add(u)

        # 2. Create Vehicles
        today = date.today()
        vehicles = [
            # Healthy Active Bus
            Vehicle(
                id="veh-v1", plate_no="WB-01-AB-1234", v_type="Bus",
                odometer_km=42000.0, last_service_km=40000.0,
                last_service_date=today - timedelta(days=30),
                insurance_expiry=today + timedelta(days=200),
                status=VehicleStatus.ACTIVE, engine_hours=120.0
            ),
            # Expiring Insurance Soon Van
            Vehicle(
                id="veh-v2", plate_no="WB-02-CD-5678", v_type="Van",
                odometer_km=15000.0, last_service_km=14500.0,
                last_service_date=today - timedelta(days=15),
                insurance_expiry=today + timedelta(days=12),  # Compliance alert < 30 days
                status=VehicleStatus.IDLE, engine_hours=45.0
            ),
            # Already Expired Insurance Truck
            Vehicle(
                id="veh-v3", plate_no="WB-03-EF-9012", v_type="Truck",
                odometer_km=85000.0, last_service_km=82000.0,
                last_service_date=today - timedelta(days=45),
                insurance_expiry=today - timedelta(days=5),  # Compliance alert expired
                status=VehicleStatus.ACTIVE, engine_hours=320.0
            ),
            # Overdue maintenance Bus (15000km since service, >10000 limit)
            Vehicle(
                id="veh-v4", plate_no="WB-04-GH-3456", v_type="Bus",
                odometer_km=95000.0, last_service_km=80000.0,  # 15000km difference
                last_service_date=today - timedelta(days=90),
                insurance_expiry=today + timedelta(days=150),
                status=VehicleStatus.IDLE, engine_hours=480.0
            ),
            # In Shop Van (for predictive risk / shop status tests)
            Vehicle(
                id="veh-v5", plate_no="WB-05-IJ-7890", v_type="Van",
                odometer_km=52000.0, last_service_km=43000.0,  # 9000km
                last_service_date=today - timedelta(days=200),  # > 180 days -> Risk Overdue
                insurance_expiry=today + timedelta(days=90),
                status=VehicleStatus.IN_SHOP, engine_hours=210.0
            ),
            # Retired Truck
            Vehicle(
                id="veh-v6", plate_no="WB-06-KL-1234", v_type="Truck",
                odometer_km=250000.0, last_service_km=248000.0,
                last_service_date=today - timedelta(days=120),
                insurance_expiry=today + timedelta(days=365),
                status=VehicleStatus.RETIRED, engine_hours=980.0
            ),
            # 6 more vehicles to total 12
            Vehicle(
                id="veh-v7", plate_no="WB-07-MN-5678", v_type="Truck",
                odometer_km=31000.0, last_service_km=30500.0,
                last_service_date=today - timedelta(days=10),
                insurance_expiry=today + timedelta(days=250),
                status=VehicleStatus.ACTIVE, engine_hours=60.0
            ),
            Vehicle(
                id="veh-v8", plate_no="WB-08-OP-9012", v_type="Bus",
                odometer_km=110000.0, last_service_km=108000.0,
                last_service_date=today - timedelta(days=40),
                insurance_expiry=today + timedelta(days=180),
                status=VehicleStatus.IDLE, engine_hours=450.0
            ),
            Vehicle(
                id="veh-v9", plate_no="WB-09-QR-3456", v_type="Van",
                odometer_km=64000.0, last_service_km=54000.0,  # 10000km since service
                last_service_date=today - timedelta(days=60),
                insurance_expiry=today + timedelta(days=120),
                status=VehicleStatus.ACTIVE, engine_hours=180.0
            ),
            Vehicle(
                id="veh-v10", plate_no="WB-10-ST-7890", v_type="Truck",
                odometer_km=18000.0, last_service_km=10000.0,
                last_service_date=today - timedelta(days=140),
                insurance_expiry=today + timedelta(days=45),
                status=VehicleStatus.ACTIVE, engine_hours=90.0
            ),
            Vehicle(
                id="veh-v11", plate_no="WB-11-UV-1234", v_type="Bus",
                odometer_km=75000.0, last_service_km=71000.0,
                last_service_date=today - timedelta(days=100),
                insurance_expiry=today + timedelta(days=300),
                status=VehicleStatus.ACTIVE, engine_hours=310.0
            ),
            Vehicle(
                id="veh-v12", plate_no="WB-12-WX-5678", v_type="Van",
                odometer_km=3000.0, last_service_km=0.0,
                last_service_date=today - timedelta(days=300),  # > 180 days -> overdue by date
                insurance_expiry=today + timedelta(days=22),   # expiring in 22 days
                status=VehicleStatus.IDLE, engine_hours=80.0
            ),
        ]
        for v in vehicles:
            session.add(v)

        # 3. Create Drivers
        drivers = [
            # High safety profile driver (Excellent)
            Driver(
                id="drv-d1", name="Robert Taylor", license_no="DL-987654",
                license_expiry=today + timedelta(days=700), violations=0,
                trips_completed=48, hours_driven_7d=35.0,
                last_trip_end=datetime.utcnow() - timedelta(hours=12),
                linked_user_id="usr-driver"
            ),
            # Overworked/Violating Driver (Warning)
            Driver(
                id="drv-d2", name="James Smith", license_no="DL-123456",
                license_expiry=today + timedelta(days=180), violations=3,
                trips_completed=12, hours_driven_7d=58.0,  # Fatigue risk (>50h)
                last_trip_end=datetime.utcnow() - timedelta(hours=10),
                linked_user_id=None
            ),
            # Middle profile driver (Good)
            Driver(
                id="drv-d3", name="Patricia Brown", license_no="DL-654321",
                license_expiry=today + timedelta(days=450), violations=1,
                trips_completed=25, hours_driven_7d=40.0,
                last_trip_end=datetime.utcnow() - timedelta(hours=24),
                linked_user_id=None
            ),
            # Driver on active trip
            Driver(
                id="drv-d4", name="John Davis", license_no="DL-246810",
                license_expiry=today + timedelta(days=30), violations=0,
                trips_completed=60, hours_driven_7d=42.0,
                last_trip_end=datetime.utcnow() - timedelta(hours=2),
                linked_user_id=None
            ),
            # Rest fatigue driver (Not rested: <8h gap)
            Driver(
                id="drv-d5", name="Linda Miller", license_no="DL-135792",
                license_expiry=today + timedelta(days=900), violations=0,
                trips_completed=5, hours_driven_7d=20.0,
                last_trip_end=datetime.utcnow() - timedelta(hours=4),  # < 8 hours rest
                linked_user_id=None
            ),
            # 5 more drivers to make 10
            Driver(id="drv-d6", name="William Wilson", license_no="DL-333444", license_expiry=today + timedelta(days=320), violations=0, trips_completed=10, hours_driven_7d=15.0),
            Driver(id="drv-d7", name="Elizabeth Moore", license_no="DL-555666", license_expiry=today + timedelta(days=420), violations=2, trips_completed=18, hours_driven_7d=30.0),
            Driver(id="drv-d8", name="David Taylor", license_no="DL-777888", license_expiry=today + timedelta(days=120), violations=1, trips_completed=32, hours_driven_7d=45.0),
            Driver(id="drv-d9", name="Jennifer Thomas", license_no="DL-999000", license_expiry=today + timedelta(days=600), violations=4, trips_completed=2, hours_driven_7d=12.0),
            Driver(id="drv-d10", name="Charles Jackson", license_no="DL-111222", license_expiry=today + timedelta(days=500), violations=0, trips_completed=50, hours_driven_7d=28.0),
        ]
        for d in drivers:
            session.add(d)

        # 4. Fuel Log Entries (with 2 deliberate anomalies)
        # Vehicle 1 fuel history (wb-01-ab-1234)
        fuel_logs = [
            FuelLogEntry(id="fuel-v1-1", vehicle_id="veh-v1", date=today - timedelta(days=20), odometer_km=40300.0, liters=42.0, cost=3780.0),
            FuelLogEntry(id="fuel-v1-2", vehicle_id="veh-v1", date=today - timedelta(days=15), odometer_km=40600.0, liters=41.5, cost=3735.0),
            FuelLogEntry(id="fuel-v1-3", vehicle_id="veh-v1", date=today - timedelta(days=10), odometer_km=40900.0, liters=40.8, cost=3672.0),
            # Anomaly liters = 95 (Very high compared to 40.8-42.0 mean/stddev)
            FuelLogEntry(id="fuel-v1-4", vehicle_id="veh-v1", date=today - timedelta(days=5), odometer_km=41200.0, liters=95.0, cost=8550.0),
            FuelLogEntry(id="fuel-v1-5", vehicle_id="veh-v1", date=today - timedelta(days=1), odometer_km=41500.0, liters=41.2, cost=3708.0),

            # Vehicle 2 fuel history
            FuelLogEntry(id="fuel-v2-1", vehicle_id="veh-v2", date=today - timedelta(days=16), odometer_km=14600.0, liters=25.0, cost=2250.0),
            FuelLogEntry(id="fuel-v2-2", vehicle_id="veh-v2", date=today - timedelta(days=12), odometer_km=14750.0, liters=24.5, cost=2205.0),
            FuelLogEntry(id="fuel-v2-3", vehicle_id="veh-v2", date=today - timedelta(days=8), odometer_km=14900.0, liters=26.0, cost=2340.0),
            # Anomaly liters = 5 (Very low compared to ~25 mean)
            FuelLogEntry(id="fuel-v2-4", vehicle_id="veh-v2", date=today - timedelta(days=4), odometer_km=15000.0, liters=5.0, cost=450.0),
            FuelLogEntry(id="fuel-v2-5", vehicle_id="veh-v2", date=today - timedelta(days=1), odometer_km=15100.0, liters=25.2, cost=2268.0),

            # Normal fuel entries for others
            FuelLogEntry(id="fuel-v3-1", vehicle_id="veh-v3", date=today - timedelta(days=15), odometer_km=82500.0, liters=60.0, cost=5400.0),
            FuelLogEntry(id="fuel-v3-2", vehicle_id="veh-v3", date=today - timedelta(days=10), odometer_km=83100.0, liters=58.5, cost=5265.0),
            FuelLogEntry(id="fuel-v3-3", vehicle_id="veh-v3", date=today - timedelta(days=5), odometer_km=83700.0, liters=61.0, cost=5490.0),
            FuelLogEntry(id="fuel-v3-4", vehicle_id="veh-v3", date=today - timedelta(days=1), odometer_km=84300.0, liters=59.5, cost=5355.0),

            FuelLogEntry(id="fuel-v7-1", vehicle_id="veh-v7", date=today - timedelta(days=5), odometer_km=30700.0, liters=55.0, cost=4950.0),
        ]
        for f in fuel_logs:
            session.add(f)

        # 5. Service Log Entries
        service_logs = [
            ServiceLogEntry(id="srv-1", vehicle_id="veh-v1", date=today - timedelta(days=30), description="Routine 40k Service, Oil Filter replacement", cost=4500.0, odometer_km=40000.0),
            ServiceLogEntry(id="srv-2", vehicle_id="veh-v2", date=today - timedelta(days=15), description="AC compressor repair", cost=12000.0, odometer_km=14500.0),
            ServiceLogEntry(id="srv-3", vehicle_id="veh-v3", date=today - timedelta(days=45), description="Brake pads replacement and wheel alignment", cost=6800.0, odometer_km=82000.0),
            ServiceLogEntry(id="srv-4", vehicle_id="veh-v4", date=today - timedelta(days=90), description="Minor servicing", cost=2500.0, odometer_km=80000.0),
            ServiceLogEntry(id="srv-5", vehicle_id="veh-v5", date=today - timedelta(days=200), description="Engine tuning and suspension check", cost=8500.0, odometer_km=43000.0),
        ]
        for s in service_logs:
            session.add(s)

        # 6. Trips (20 trips across all statuses)
        trips = [
            # Completed trips (recent)
            Trip(id="trip-1", origin="Warehouse A", destination="Retail Shop 1", scheduled_start=datetime.utcnow() - timedelta(days=5), vehicle_id="veh-v1", driver_id="drv-d1", status=TripStatus.COMPLETED, distance_km=120.0),
            Trip(id="trip-2", origin="Factory Yard", destination="Distribution Center", scheduled_start=datetime.utcnow() - timedelta(days=4), vehicle_id="veh-v3", driver_id="drv-d3", status=TripStatus.COMPLETED, distance_km=250.0),
            Trip(id="trip-3", origin="Port Depot", destination="Warehouse B", scheduled_start=datetime.utcnow() - timedelta(days=3), vehicle_id="veh-v7", driver_id="drv-d4", status=TripStatus.COMPLETED, distance_km=80.0),
            Trip(id="trip-4", origin="Retail Shop 1", destination="Warehouse A", scheduled_start=datetime.utcnow() - timedelta(days=2), vehicle_id="veh-v1", driver_id="drv-d1", status=TripStatus.COMPLETED, distance_km=122.0),
            Trip(id="trip-5", origin="Warehouse B", destination="Retail Shop 2", scheduled_start=datetime.utcnow() - timedelta(days=1), vehicle_id="veh-v3", driver_id="drv-d7", status=TripStatus.COMPLETED, distance_km=150.0),
            Trip(id="trip-6", origin="HQ", destination="Airport Term 1", scheduled_start=datetime.utcnow() - timedelta(days=6), vehicle_id="veh-v2", driver_id="drv-d3", status=TripStatus.COMPLETED, distance_km=45.0),
            Trip(id="trip-7", origin="Airport Term 1", destination="HQ", scheduled_start=datetime.utcnow() - timedelta(days=6), vehicle_id="veh-v2", driver_id="drv-d3", status=TripStatus.COMPLETED, distance_km=45.0),

            # In Transit trips (Active)
            Trip(id="trip-8", origin="Warehouse A", destination="Client Site Z", scheduled_start=datetime.utcnow() - timedelta(hours=2), vehicle_id="veh-v1", driver_id="drv-d1", status=TripStatus.IN_TRANSIT),
            Trip(id="trip-9", origin="Port Depot", destination="Factory Yard", scheduled_start=datetime.utcnow() - timedelta(hours=1), vehicle_id="veh-v3", driver_id="drv-d4", status=TripStatus.IN_TRANSIT),

            # Assigned trips (Active)
            Trip(id="trip-10", origin="Depot East", destination="Tech Park South", scheduled_start=datetime.utcnow() + timedelta(hours=3), vehicle_id="veh-v8", driver_id="drv-d8", status=TripStatus.ASSIGNED),
            Trip(id="trip-11", origin="Warehouse B", destination="Distribution Center", scheduled_start=datetime.utcnow() + timedelta(hours=5), vehicle_id="veh-v10", driver_id="drv-d10", status=TripStatus.ASSIGNED),

            # Delayed trips
            Trip(id="trip-12", origin="HQ", destination="Exhibition Hall", scheduled_start=datetime.utcnow() - timedelta(minutes=45), vehicle_id="veh-v9", driver_id="drv-d3", status=TripStatus.DELAYED),

            # Cancelled trips
            Trip(id="trip-13", origin="Depot East", destination="Airport Term 2", scheduled_start=datetime.utcnow() - timedelta(days=2), vehicle_id="veh-v2", driver_id="drv-d2", status=TripStatus.CANCELLED),
            Trip(id="trip-14", origin="Client Site Y", destination="HQ", scheduled_start=datetime.utcnow() - timedelta(days=3), vehicle_id="veh-v5", driver_id="drv-d6", status=TripStatus.CANCELLED),

            # Unassigned Trips (requiring dispatcher attention / auto-assign demo)
            Trip(id="trip-15", origin="Warehouse B", destination="Retail Store 4", scheduled_start=datetime.utcnow() + timedelta(hours=10), status=TripStatus.ASSIGNED),
            Trip(id="trip-16", origin="Depot North", destination="Cargo Terminal", scheduled_start=datetime.utcnow() + timedelta(hours=12), status=TripStatus.ASSIGNED),
            Trip(id="trip-17", origin="HQ", destination="Suburban Station", scheduled_start=datetime.utcnow() + timedelta(hours=24), status=TripStatus.ASSIGNED),
            Trip(id="trip-18", origin="Client Site Z", destination="Port Depot", scheduled_start=datetime.utcnow() + timedelta(days=2), status=TripStatus.ASSIGNED),
            Trip(id="trip-19", origin="Factory Yard", destination="HQ", scheduled_start=datetime.utcnow() + timedelta(days=3), status=TripStatus.ASSIGNED),
            Trip(id="trip-20", origin="Port Depot", destination="Warehouse A", scheduled_start=datetime.utcnow() + timedelta(days=4), status=TripStatus.ASSIGNED),
        ]
        for t in trips:
            session.add(t)

        session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    from backend.database import create_db_and_tables
    create_db_and_tables()
    seed_database()
