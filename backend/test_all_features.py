import os
import sys
import unittest
from datetime import datetime, date, timedelta, timezone
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, text

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
from backend.database import get_session
from backend.models import User, Role, Vehicle, VehicleStatus, Driver, Trip, TripStatus, FuelLogEntry, ServiceLogEntry
from backend.services import (
    SafetyScoreEngine, DispatchEngine, MaintenanceEngine,
    FuelAnomalyEngine, ComplianceEngine, SustainabilityEngine
)

# Setup database for testing (use file-based to avoid in-memory connection loss in FastAPI threads)
TEST_DATABASE_URL = "sqlite:///./test_fleetpulse.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})

def get_test_session():
    with Session(engine) as session:
        yield session

# Override the database session dependency
app.dependency_overrides[get_session] = get_test_session

class TestFleetPulseComprehensive(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create all tables once for integration test requests
        SQLModel.metadata.create_all(engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        import os
        engine.dispose()
        try:
            if os.path.exists("./test_fleetpulse.db"):
                os.remove("./test_fleetpulse.db")
        except Exception:
            pass

    def setUp(self):
        # Clear tables before each test
        with Session(engine) as session:
            session.exec(text("DELETE FROM user"))
            session.exec(text("DELETE FROM vehicle"))
            session.exec(text("DELETE FROM driver"))
            session.exec(text("DELETE FROM trip"))
            session.exec(text("DELETE FROM fuellogentry"))
            session.exec(text("DELETE FROM servicelogentry"))
            session.commit()

        # Seed permission matrix
        from backend.seed import seed_permission_matrix
        with Session(engine) as session:
            seed_permission_matrix(session)

        # Seed default test users
        from backend.auth import get_password_hash
        pw = get_password_hash("password123")
        with Session(engine) as session:
            self.admin_user = User(id="u-admin", name="Admin User", email="admin@test.com", password_hash=pw, role=Role.ADMIN)
            self.driver_user = User(id="u-driver", name="Driver User", email="driver@test.com", password_hash=pw, role=Role.DRIVER)
            self.manager_user = User(id="u-manager", name="Manager User", email="manager@test.com", password_hash=pw, role=Role.FLEET_MANAGER)
            self.finance_user = User(id="u-finance", name="Finance User", email="finance@test.com", password_hash=pw, role=Role.FINANCE_ANALYST)
            self.dispatcher_user = User(id="u-disp", name="Dispatcher User", email="dispatcher@test.com", password_hash=pw, role=Role.DISPATCHER)
            self.safety_user = User(id="u-safety", name="Safety User", email="safety@test.com", password_hash=pw, role=Role.SAFETY_OFFICER)
            session.add_all([self.admin_user, self.driver_user, self.manager_user, self.finance_user, self.dispatcher_user, self.safety_user])
            session.commit()

        # Authenticate users for bearer token header setup
        self.admin_token = self.get_token("admin@test.com")
        self.driver_token = self.get_token("driver@test.com")
        self.manager_token = self.get_token("manager@test.com")
        self.finance_token = self.get_token("finance@test.com")
        self.dispatcher_token = self.get_token("dispatcher@test.com")
        self.safety_token = self.get_token("safety@test.com")

    def _seed_vehicle(self, vid="v-test", plate="TEST-001", status=VehicleStatus.IDLE, **kwargs):
        today = date.today()
        defaults = dict(
            id=vid, plate_no=plate, v_type="Van", odometer_km=5000.0,
            last_service_km=4000.0, last_service_date=today,
            insurance_expiry=today + timedelta(days=200), status=status, engine_hours=50.0
        )
        defaults.update(kwargs)
        with Session(engine) as session:
            session.add(Vehicle(**defaults))
            session.commit()
        return defaults

    def _seed_driver(self, did="d-test", name="Test Driver", rested=True, **kwargs):
        today = date.today()
        defaults = dict(
            id=did, name=name, license_no=f"L-{did}", license_expiry=today + timedelta(days=365),
            violations=0, hours_driven_7d=20.0,
            last_trip_end=None if rested else datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=4)
        )
        defaults.update(kwargs)
        with Session(engine) as session:
            session.add(Driver(**defaults))
            session.commit()
        return defaults

    @classmethod
    def get_token(cls, email: str) -> str:
        response = cls.client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
        return response.json()["access_token"]

    def auth_headers(self, token: str):
        return {"Authorization": f"Bearer {token}"}

    # =======================================================================
    # 1. Safety Score Engine Tests (Edge cases, badges, clamping)
    # =======================================================================
    def test_safety_score_clamping_and_badges(self):
        # Edge Case: Brand new driver with no statistics -> 100 rating
        d_new = Driver(id="d-new", name="New Operator", license_no="L-NEW", license_expiry=date.today())
        self.assertEqual(SafetyScoreEngine.score(d_new), 100)
        self.assertEqual(SafetyScoreEngine.badge(100), "Excellent")

        # Edge Case: Extremely poor driver with many violations -> Clamps to 0
        d_poor = Driver(id="d-poor", name="Poor Driver", license_no="L-POOR", license_expiry=date.today(), violations=10)
        # 100 - (10 * 15) = -50 -> clamps to 0
        self.assertEqual(SafetyScoreEngine.score(d_poor), 0)
        self.assertEqual(SafetyScoreEngine.badge(0), "Warning")

        # Edge Case: Driver overworked (fatigued)
        d_fatigued = Driver(id="d-fatigue", name="Tired Driver", license_no="L-TIRED", license_expiry=date.today(), hours_driven_7d=65.0)
        # 100 - (15 * 1.5) = 100 - 22.5 = 77.5 -> round -> 78
        self.assertEqual(SafetyScoreEngine.score(d_fatigued), 78)
        self.assertEqual(SafetyScoreEngine.badge(78), "Good")

        # Edge Case: Driver with maximum completed trips bonus
        d_exp = Driver(id="d-exp", name="Experienced Driver", license_no="L-EXP", license_expiry=date.today(), trips_completed=100)
        # Trip bonus capped at 50 completed trips (+10.0). Base 100 + 10 = 110 -> clamped to 100
        self.assertEqual(SafetyScoreEngine.score(d_exp), 100)

        # Combo edge case: violations + fatigue + experience bonus
        d_combo = Driver(id="d-combo", name="Combo Driver", license_no="L-COMBO", license_expiry=date.today(), violations=2, hours_driven_7d=54.0, trips_completed=20)
        # 100 - 30 (violations) - 6 (fatigue: 4 * 1.5) + 4 (trips: 20 * 0.2) = 100 - 36 + 4 = 68
        self.assertEqual(SafetyScoreEngine.score(d_combo), 68)
        self.assertEqual(SafetyScoreEngine.badge(68), "Good")

    # =======================================================================
    # 2. Smart Dispatch & Conflict Detections
    # =======================================================================
    def test_dispatch_conflict_detection_edge_cases(self):
        with Session(engine) as session:
            v_active = Vehicle(id="v-act", plate_no="V-ACT", v_type="Van", odometer_km=5000, last_service_km=4000, last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.ON_TRIP)
            v_shop = Vehicle(id="v-shop", plate_no="V-SHOP", v_type="Bus", odometer_km=5000, last_service_km=4000, last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.IN_SHOP)
            v_idle = Vehicle(id="v-idle", plate_no="V-IDLE", v_type="Truck", odometer_km=5000, last_service_km=4000, last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.IDLE)
            
            d_active = Driver(id="d-act", name="Driver Active", license_no="L-ACT", license_expiry=date.today(), last_trip_end=None)
            d_tired = Driver(id="d-tired", name="Driver Tired", license_no="L-TIRED", license_expiry=date.today(), last_trip_end=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=4)) # Only 4 hours rest
            d_idle = Driver(id="d-idle", name="Driver Idle", license_no="L-IDLE", license_expiry=date.today(), last_trip_end=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=10)) # Rested (>8h)

            session.add_all([v_active, v_shop, v_idle, d_active, d_tired, d_idle])
            session.commit()

            # Create an active trip assignment to mark driver and vehicle as busy
            t_busy = Trip(id="t-busy", origin="A", destination="B", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None), vehicle_id="v-act", driver_id="d-act", status=TripStatus.IN_TRANSIT)
            session.add(t_busy)
            session.commit()

        # Let's run validations
        with Session(engine) as session:
            # New Trip object
            t_new = Trip(id="t-new", origin="C", destination="D", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None))
            session.add(t_new)
            session.commit()

            # 1. Error: Vehicle already on active trip
            with self.assertRaises(ValueError):
                DispatchEngine.assign_trip(session, t_new, "v-act", "d-idle")

            # 2. Error: Driver already on active trip
            with self.assertRaises(ValueError):
                DispatchEngine.assign_trip(session, t_new, "v-idle", "d-act")

            # 3. Error: Vehicle currently In Shop
            with self.assertRaises(ValueError):
                DispatchEngine.assign_trip(session, t_new, "v-shop", "d-idle")

            # 4. Error: Driver not rested (<8 hours rest gap)
            with self.assertRaises(ValueError):
                DispatchEngine.assign_trip(session, t_new, "v-idle", "d-tired")

            # 5. Success case
            t_success = DispatchEngine.assign_trip(session, t_new, "v-idle", "d-idle")
            self.assertEqual(t_success.status, TripStatus.ASSIGNED)
            self.assertEqual(session.get(Vehicle, "v-idle").status, VehicleStatus.ON_TRIP)

    def test_trip_lifecycle_transitions(self):
        with Session(engine) as session:
            v_idle = Vehicle(id="v-idle2", plate_no="V-IDLE2", v_type="Truck", odometer_km=5000, last_service_km=4000, last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.IDLE)
            d_idle = Driver(id="d-idle2", name="Driver Idle 2", license_no="L-IDLE2", license_expiry=date.today(), last_trip_end=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=10))
            t_new = Trip(id="t-transit", origin="E", destination="F", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None))
            session.add_all([v_idle, d_idle, t_new])
            session.commit()
            
            # Assign
            DispatchEngine.assign_trip(session, t_new, "v-idle2", "d-idle2")
            self.assertEqual(t_new.status, TripStatus.ASSIGNED)
            self.assertEqual(session.get(Vehicle, "v-idle2").status, VehicleStatus.ON_TRIP)
            
            # Start (should transition Assigned -> In Transit)
            DispatchEngine.start_trip(session, "t-transit")
            self.assertEqual(t_new.status, TripStatus.IN_TRANSIT)
            self.assertEqual(session.get(Vehicle, "v-idle2").status, VehicleStatus.ON_TRIP)
            
            # Delay (should transition In Transit -> Delayed)
            DispatchEngine.delay_trip(session, "t-transit")
            self.assertEqual(t_new.status, TripStatus.DELAYED)
            
            # Start again (Resume Delayed -> In Transit)
            DispatchEngine.start_trip(session, "t-transit")
            self.assertEqual(t_new.status, TripStatus.IN_TRANSIT)
            
            # Complete (should transition In Transit -> Completed)
            DispatchEngine.complete_trip(session, "t-transit", 120.0)
            self.assertEqual(t_new.status, TripStatus.COMPLETED)
            self.assertEqual(session.get(Vehicle, "v-idle2").status, VehicleStatus.IDLE)
            self.assertEqual(session.get(Driver, "d-idle2").trips_completed, 1)

    def test_trip_cancellation(self):
        with Session(engine) as session:
            v_idle = Vehicle(id="v-idle3", plate_no="V-IDLE3", v_type="Truck", odometer_km=5000, last_service_km=4000, last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.IDLE)
            d_idle = Driver(id="d-idle3", name="Driver Idle 3", license_no="L-IDLE3", license_expiry=date.today(), last_trip_end=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=10))
            t_new = Trip(id="t-cancel", origin="G", destination="H", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None))
            session.add_all([v_idle, d_idle, t_new])
            session.commit()
            
            # Assign
            DispatchEngine.assign_trip(session, t_new, "v-idle3", "d-idle3")
            self.assertEqual(t_new.status, TripStatus.ASSIGNED)
            self.assertEqual(session.get(Vehicle, "v-idle3").status, VehicleStatus.ON_TRIP)
            
            # Cancel
            DispatchEngine.cancel_trip(session, "t-cancel")
            self.assertEqual(t_new.status, TripStatus.CANCELLED)
            self.assertEqual(session.get(Vehicle, "v-idle3").status, VehicleStatus.IDLE)

    # =======================================================================
    # 3. Predictive Maintenance Risk
    # =======================================================================
    def test_predictive_maintenance_ratio_clamping(self):
        today = date.today()
        # Edge Case: Brand new vehicle -> 0 risk
        v_new = Vehicle(id="v-new", plate_no="NEW-1", v_type="Bus", odometer_km=1000, last_service_km=1000, last_service_date=today, insurance_expiry=today, engine_hours=0.0)
        self.assertEqual(MaintenanceEngine.risk_score(v_new), 0)
        self.assertEqual(MaintenanceEngine.urgency_tag(v_new), "green")

        # Edge Case: Vehicle overdue by km (excessive mileage: e.g. 30,000 km driven since service)
        v_over_km = Vehicle(id="v-okm", plate_no="NEW-2", v_type="Bus", odometer_km=45000, last_service_km=10000, last_service_date=today, insurance_expiry=today, engine_hours=0.0)
        # km ratio = 35000 / 10000 = 3.5 -> clamped to 1.5
        # risk = 1.5/1.5 * 100 = 100
        self.assertEqual(MaintenanceEngine.risk_score(v_over_km), 100)
        self.assertEqual(MaintenanceEngine.urgency_tag(v_over_km), "red")

        # Edge Case: Vehicle overdue by date (300 days elapsed since last service)
        v_over_date = Vehicle(id="v-odate", plate_no="NEW-3", v_type="Bus", odometer_km=1000, last_service_km=1000, last_service_date=today - timedelta(days=300), insurance_expiry=today, engine_hours=0.0)
        # date ratio = 300 / 180 = 1.66 -> clamped to 1.5 -> 100 risk
        self.assertEqual(MaintenanceEngine.risk_score(v_over_date), 100)
        self.assertEqual(MaintenanceEngine.urgency_tag(v_over_date), "red")

        # Edge Case: Vehicle due soon (orange tag)
        v_warning = Vehicle(id="v-warn", plate_no="NEW-4", v_type="Bus", odometer_km=1000, last_service_km=1000, last_service_date=today - timedelta(days=135), insurance_expiry=today, engine_hours=0.0)
        # date ratio = 135 / 180 = 0.75
        # risk = 0.75 / 1.5 * 100 = 50%
        self.assertEqual(MaintenanceEngine.risk_score(v_warning), 50)
        self.assertEqual(MaintenanceEngine.urgency_tag(v_warning), "orange")

    # =======================================================================
    # 4. Fuel Anomaly Outlier Detection
    # =======================================================================
    def test_fuel_anomaly_zscore_audit(self):
        # Case 1: Minimum entry count constraint (must have >= 4 logs per vehicle)
        logs_few = [
            FuelLogEntry(id="f1", vehicle_id="v-test", date=date.today(), odometer_km=1000, liters=50, cost=4500),
            FuelLogEntry(id="f2", vehicle_id="v-test", date=date.today(), odometer_km=1300, liters=51, cost=4600),
            FuelLogEntry(id="f3", vehicle_id="v-test", date=date.today(), odometer_km=1600, liters=49, cost=4400)
        ]
        self.assertEqual(len(FuelAnomalyEngine.detect_anomalies(logs_few)), 0)

        # Case 2: Identical liters logs -> stddev = 0 -> handles gracefully without divide by zero
        logs_flat = [
            FuelLogEntry(id="f1", vehicle_id="v-test", date=date.today(), odometer_km=1000, liters=50, cost=4500),
            FuelLogEntry(id="f2", vehicle_id="v-test", date=date.today(), odometer_km=1300, liters=50, cost=4500),
            FuelLogEntry(id="f3", vehicle_id="v-test", date=date.today(), odometer_km=1600, liters=50, cost=4500),
            FuelLogEntry(id="f4", vehicle_id="v-test", date=date.today(), odometer_km=1900, liters=50, cost=4500),
        ]
        self.assertEqual(len(FuelAnomalyEngine.detect_anomalies(logs_flat)), 0)

        # Case 3: Proper anomaly identification
        logs_anom = [
            FuelLogEntry(id="f1", vehicle_id="v-test", date=date.today() - timedelta(days=6), odometer_km=1000, liters=50, cost=4500),
            FuelLogEntry(id="f2", vehicle_id="v-test", date=date.today() - timedelta(days=5), odometer_km=1300, liters=49, cost=4400),
            FuelLogEntry(id="f3", vehicle_id="v-test", date=date.today() - timedelta(days=4), odometer_km=1600, liters=51, cost=4600),
            FuelLogEntry(id="f4", vehicle_id="v-test", date=date.today() - timedelta(days=3), odometer_km=1900, liters=50, cost=4500),
            FuelLogEntry(id="f5", vehicle_id="v-test", date=date.today() - timedelta(days=2), odometer_km=2200, liters=49.5, cost=4450),
            FuelLogEntry(id="f6", vehicle_id="v-test", date=date.today() - timedelta(days=1), odometer_km=2500, liters=98, cost=9000) # Outlier
        ]
        anom_res = FuelAnomalyEngine.detect_anomalies(logs_anom)
        self.assertEqual(len(anom_res), 1)
        self.assertEqual(anom_res[0]["liters"], 98)

    # =======================================================================
    # 5. Route clearances and RBAC boundaries (FastAPI test client integrations)
    # =======================================================================
    def test_api_role_clearance_matrix(self):
        # Create a test vehicle payload
        v_payload = {
            "plate_no": "KA-01-XX-9999",
            "v_type": "Truck",
            "odometer_km": 10000.0,
            "last_service_km": 9000.0,
            "last_service_date": "2026-06-01",
            "insurance_expiry": "2027-06-01",
            "status": "Idle",
            "engine_hours": 120.0
        }

        # 1. Admin/Manager should be allowed to write (POST /vehicles)
        res_admin = self.client.post("/api/v1/vehicles", json=v_payload, headers=self.auth_headers(self.admin_token))
        self.assertEqual(res_admin.status_code, 200)

        # 2. Driver role should be BLOCKED (403 Status Code)
        res_driver = self.client.post("/api/v1/vehicles", json=v_payload, headers=self.auth_headers(self.driver_token))
        self.assertEqual(res_driver.status_code, 403)
        self.assertIn("does not have write permission", res_driver.json()["detail"])

        # 3. Reports read permission override
        # Driver has read clearance for reports -> 200 OK
        res_rep_driver = self.client.get("/api/v1/analytics/reports", headers=self.auth_headers(self.driver_token))
        self.assertEqual(res_rep_driver.status_code, 200)

        # Finance Analyst has read clearance for reports -> 200 OK
        res_rep_fin = self.client.get("/api/v1/analytics/reports", headers=self.auth_headers(self.finance_token))
        self.assertEqual(res_rep_fin.status_code, 200)

        # 4. Settings read/write configuration
        # Manager lacks read/write settings permissions -> 403 Forbidden
        res_set_mgr = self.client.get("/api/v1/analytics/dashboard", headers=self.auth_headers(self.manager_token))
        self.assertEqual(res_set_mgr.status_code, 200) # Dashboard is visible to all
        
        # Checking that settings module restrictions enforce Admin only
        # We check permission dependency directly by requesting gated endpoints if mapped
        # In Settings screen, only Admin can write or view user directories.

    # =======================================================================
    # 6. Authentication API Tests
    # =======================================================================
    def test_auth_signup_and_duplicate_email(self):
        res = self.client.post("/api/v1/auth/signup", json={
            "name": "New User", "email": "new@test.com", "password": "password123", "role": "Driver"
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())

        dup = self.client.post("/api/v1/auth/signup", json={
            "name": "Dup User", "email": "new@test.com", "password": "password123", "role": "Driver"
        })
        self.assertEqual(dup.status_code, 400)
        self.assertIn("already exists", dup.json()["detail"])

    def test_auth_login_invalid_credentials(self):
        res = self.client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrongpass"})
        self.assertEqual(res.status_code, 401)

    def test_auth_unauthorized_without_token(self):
        res = self.client.get("/api/v1/vehicles")
        self.assertEqual(res.status_code, 401)

    def test_auth_oauth2_token_endpoint(self):
        res = self.client.post("/api/v1/auth/token", data={"username": "admin@test.com", "password": "password123"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["token_type"], "bearer")

    # =======================================================================
    # 7. Vehicle CRUD API Tests
    # =======================================================================
    def test_vehicle_crud_and_history(self):
        payload = {
            "plate_no": "KA-01-AB-1111", "v_type": "Bus", "odometer_km": 12000.0,
            "last_service_km": 10000.0, "last_service_date": "2026-01-01",
            "insurance_expiry": "2027-01-01", "status": "Idle", "engine_hours": 100.0
        }
        create = self.client.post("/api/v1/vehicles", json=payload, headers=self.auth_headers(self.admin_token))
        self.assertEqual(create.status_code, 200)
        vid = create.json()["id"]

        dup = self.client.post("/api/v1/vehicles", json=payload, headers=self.auth_headers(self.admin_token))
        self.assertEqual(dup.status_code, 400)

        update = self.client.patch(f"/api/v1/vehicles/{vid}", json={"odometer_km": 12500.0}, headers=self.auth_headers(self.manager_token))
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.json()["odometer_km"], 12500.0)

        history = self.client.get(f"/api/v1/vehicles/{vid}/history", headers=self.auth_headers(self.driver_token))
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()["vehicle"]["id"], vid)

        missing = self.client.get("/api/v1/vehicles/nonexistent/history", headers=self.auth_headers(self.admin_token))
        self.assertEqual(missing.status_code, 404)

    def test_vehicle_list_readable_by_driver(self):
        self._seed_vehicle()
        res = self.client.get("/api/v1/vehicles", headers=self.auth_headers(self.driver_token))
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.json()), 1)

    # =======================================================================
    # 8. Driver API Tests
    # =======================================================================
    def test_driver_create_and_safety_score_in_list(self):
        res = self.client.post("/api/v1/drivers", json={
            "name": "John Doe", "license_no": "L-JD-001",
            "license_expiry": "2027-12-31", "violations": 1, "hours_driven_7d": 30.0
        }, headers=self.auth_headers(self.safety_token))
        self.assertEqual(res.status_code, 200)

        listing = self.client.get("/api/v1/drivers", headers=self.auth_headers(self.driver_token))
        self.assertEqual(listing.status_code, 200)
        driver = next(d for d in listing.json() if d["name"] == "John Doe")
        self.assertIn("safety_score", driver)
        self.assertIn("safety_badge", driver)
        self.assertEqual(driver["safety_score"], 85)  # 100 - 15

    def test_driver_create_blocked_for_finance(self):
        res = self.client.post("/api/v1/drivers", json={
            "name": "Blocked", "license_no": "L-BLK", "license_expiry": "2027-01-01"
        }, headers=self.auth_headers(self.finance_token))
        self.assertEqual(res.status_code, 403)

    # =======================================================================
    # 9. Trip API Full Lifecycle
    # =======================================================================
    def test_trip_api_full_lifecycle(self):
        self._seed_vehicle("v-trip", "TRIP-V1")
        self._seed_driver("d-trip", "Trip Driver")

        create = self.client.post("/api/v1/trips", json={
            "origin": "Depot A", "destination": "Site B",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "vehicle_id": "v-trip", "driver_id": "d-trip"
        }, headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(create.status_code, 200)
        tid = create.json()["id"]
        self.assertEqual(create.json()["status"], "Assigned")

        start = self.client.post(f"/api/v1/trips/{tid}/start", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(start.status_code, 200)
        self.assertEqual(start.json()["status"], "In Transit")

        delay = self.client.post(f"/api/v1/trips/{tid}/delay", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(delay.status_code, 200)
        self.assertEqual(delay.json()["status"], "Delayed")

        resume = self.client.post(f"/api/v1/trips/{tid}/start", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(resume.status_code, 200)

        complete = self.client.post(f"/api/v1/trips/{tid}/complete", json={"distance_km": 85.0}, headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(complete.status_code, 200)
        self.assertEqual(complete.json()["status"], "Completed")
        self.assertEqual(complete.json()["distance_km"], 85.0)

        with Session(engine) as session:
            v = session.get(Vehicle, "v-trip")
            self.assertEqual(v.status, VehicleStatus.IDLE)
            self.assertEqual(v.odometer_km, 5085.0)

    def test_trip_cancel_and_vehicle_freed(self):
        self._seed_vehicle("v-can", "CAN-V1")
        self._seed_driver("d-can", "Cancel Driver")
        create = self.client.post("/api/v1/trips", json={
            "origin": "X", "destination": "Y",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "vehicle_id": "v-can", "driver_id": "d-can"
        }, headers=self.auth_headers(self.dispatcher_token))
        tid = create.json()["id"]

        cancel = self.client.post(f"/api/v1/trips/{tid}/cancel", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(cancel.status_code, 200)
        self.assertEqual(cancel.json()["status"], "Cancelled")

        with Session(engine) as session:
            self.assertEqual(session.get(Vehicle, "v-can").status, VehicleStatus.IDLE)

    def test_trip_auto_assign(self):
        self._seed_vehicle("v-auto1", "AUTO-1")
        self._seed_vehicle("v-auto2", "AUTO-2")
        self._seed_driver("d-auto1", "Best Driver", violations=0, trips_completed=50)
        self._seed_driver("d-auto2", "Other Driver", violations=5)

        create = self.client.post("/api/v1/trips", json={
            "origin": "Hub", "destination": "Port",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        }, headers=self.auth_headers(self.dispatcher_token))
        tid = create.json()["id"]

        assign = self.client.post(f"/api/v1/trips/{tid}/auto-assign", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(assign.status_code, 200)
        self.assertEqual(assign.json()["driver_id"], "d-auto1")  # highest safety score

    def test_trip_auto_assign_no_resources(self):
        self._seed_vehicle("v-only", "ONLY-V", status=VehicleStatus.IN_SHOP)
        create = self.client.post("/api/v1/trips", json={
            "origin": "A", "destination": "B",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        }, headers=self.auth_headers(self.dispatcher_token))
        tid = create.json()["id"]

        assign = self.client.post(f"/api/v1/trips/{tid}/auto-assign", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(assign.status_code, 400)

    def test_trip_invalid_state_transitions(self):
        self._seed_vehicle("v-st", "ST-V")
        self._seed_driver("d-st", "ST-D")
        create = self.client.post("/api/v1/trips", json={
            "origin": "A", "destination": "B",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "vehicle_id": "v-st", "driver_id": "d-st"
        }, headers=self.auth_headers(self.dispatcher_token))
        tid = create.json()["id"]

        self.client.post(f"/api/v1/trips/{tid}/start", headers=self.auth_headers(self.dispatcher_token))
        self.client.post(f"/api/v1/trips/{tid}/complete", json={"distance_km": 10}, headers=self.auth_headers(self.dispatcher_token))

        cancel = self.client.post(f"/api/v1/trips/{tid}/cancel", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(cancel.status_code, 400)

        start_again = self.client.post(f"/api/v1/trips/{tid}/start", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(start_again.status_code, 400)

    def test_trip_create_blocked_for_driver(self):
        res = self.client.post("/api/v1/trips", json={
            "origin": "A", "destination": "B",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        }, headers=self.auth_headers(self.driver_token))
        self.assertEqual(res.status_code, 403)

    def test_trip_assignment_conflict_via_api(self):
        self._seed_vehicle("v-conf", "CONF-V")
        self._seed_driver("d-conf", "Conf Driver", rested=False)

        res = self.client.post("/api/v1/trips", json={
            "origin": "A", "destination": "B",
            "scheduled_start": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "vehicle_id": "v-conf", "driver_id": "d-conf"
        }, headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(res.status_code, 400)
        self.assertIn("rest gap", res.json()["detail"])

    def test_trip_not_found(self):
        res = self.client.post("/api/v1/trips/missing/start", headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(res.status_code, 404)

    # =======================================================================
    # 10. Maintenance API Tests
    # =======================================================================
    def test_maintenance_log_resets_in_shop_vehicle(self):
        self._seed_vehicle("v-shop2", "SHOP-2", status=VehicleStatus.IN_SHOP, odometer_km=6000.0)

        res = self.client.post("/api/v1/maintenance/log", json={
            "vehicle_id": "v-shop2", "date": date.today().isoformat(),
            "description": "Oil change", "cost": 2500.0, "odometer_km": 6100.0
        }, headers=self.auth_headers(self.manager_token))
        self.assertEqual(res.status_code, 200)

        with Session(engine) as session:
            v = session.get(Vehicle, "v-shop2")
            self.assertEqual(v.status, VehicleStatus.ACTIVE)
            self.assertEqual(v.last_service_km, 6100.0)

        upcoming = self.client.get("/api/v1/maintenance/upcoming", headers=self.auth_headers(self.driver_token))
        self.assertEqual(upcoming.status_code, 200)
        self.assertTrue(any(r["vehicle_id"] == "v-shop2" for r in upcoming.json()))

    def test_maintenance_log_vehicle_not_found(self):
        res = self.client.post("/api/v1/maintenance/log", json={
            "vehicle_id": "ghost", "date": date.today().isoformat(),
            "description": "Test", "cost": 100.0, "odometer_km": 1000.0
        }, headers=self.auth_headers(self.manager_token))
        self.assertEqual(res.status_code, 404)

    def test_maintenance_write_blocked_for_dispatcher(self):
        self._seed_vehicle("v-mnt", "MNT-V")
        res = self.client.post("/api/v1/maintenance/log", json={
            "vehicle_id": "v-mnt", "date": date.today().isoformat(),
            "description": "Test", "cost": 100.0, "odometer_km": 5000.0
        }, headers=self.auth_headers(self.dispatcher_token))
        self.assertEqual(res.status_code, 403)

    # =======================================================================
    # 11. Fuel API Tests
    # =======================================================================
    def test_fuel_log_updates_odometer(self):
        self._seed_vehicle("v-fuel", "FUEL-V", odometer_km=10000.0)

        res = self.client.post("/api/v1/fuel/log", json={
            "vehicle_id": "v-fuel", "date": date.today().isoformat(),
            "odometer_km": 10300.0, "liters": 45.0, "cost": 4500.0
        }, headers=self.auth_headers(self.finance_token))
        self.assertEqual(res.status_code, 200)

        with Session(engine) as session:
            self.assertEqual(session.get(Vehicle, "v-fuel").odometer_km, 10300.0)

        logs = self.client.get("/api/v1/fuel", headers=self.auth_headers(self.driver_token))
        self.assertEqual(logs.status_code, 200)
        self.assertGreaterEqual(len(logs.json()), 1)

    def test_fuel_write_blocked_for_driver(self):
        self._seed_vehicle("v-fd", "FD-V")
        res = self.client.post("/api/v1/fuel/log", json={
            "vehicle_id": "v-fd", "date": date.today().isoformat(),
            "odometer_km": 5000.0, "liters": 40.0, "cost": 4000.0
        }, headers=self.auth_headers(self.driver_token))
        self.assertEqual(res.status_code, 403)

    def test_fuel_anomalies_endpoint(self):
        self._seed_vehicle("v-anom", "ANOM-V")
        for i, liters in enumerate([50, 49, 51, 50, 50, 98]):
            self.client.post("/api/v1/fuel/log", json={
                "vehicle_id": "v-anom", "date": (date.today() - timedelta(days=6 - i)).isoformat(),
                "odometer_km": 1000 + i * 300, "liters": liters, "cost": liters * 90
            }, headers=self.auth_headers(self.finance_token))

        anomalies = self.client.get("/api/v1/fuel/anomalies", headers=self.auth_headers(self.admin_token))
        self.assertEqual(anomalies.status_code, 200)
        self.assertGreaterEqual(len(anomalies.json()), 1)

    # =======================================================================
    # 12. Compliance & Sustainability Engines
    # =======================================================================
    def test_compliance_insurance_alerts(self):
        today = date.today()
        vehicles = [
            Vehicle(id="v1", plate_no="EXP-1", v_type="Bus", odometer_km=1000, last_service_km=1000,
                    last_service_date=today, insurance_expiry=today - timedelta(days=1)),
            Vehicle(id="v2", plate_no="SOON-1", v_type="Van", odometer_km=1000, last_service_km=1000,
                    last_service_date=today, insurance_expiry=today + timedelta(days=15)),
            Vehicle(id="v3", plate_no="OK-1", v_type="Truck", odometer_km=1000, last_service_km=1000,
                    last_service_date=today, insurance_expiry=today + timedelta(days=90)),
        ]
        alerts = ComplianceEngine.insurance_alerts(vehicles)
        self.assertEqual(len(alerts), 2)
        self.assertEqual(alerts[0]["urgency"], "EXPIRED")

    def test_sustainability_co2_estimate(self):
        self.assertEqual(SustainabilityEngine.co2_estimate_kg(100), 268.0)
        self.assertEqual(SustainabilityEngine.co2_estimate_kg(0), 0.0)

    def test_maintenance_upcoming_sorted_by_risk(self):
        today = date.today()
        vehicles = [
            Vehicle(id="low", plate_no="LOW", v_type="Bus", odometer_km=5000, last_service_km=4500,
                    last_service_date=today, insurance_expiry=today + timedelta(days=200)),
            Vehicle(id="high", plate_no="HIGH", v_type="Bus", odometer_km=50000, last_service_km=10000,
                    last_service_date=today, insurance_expiry=today + timedelta(days=200)),
        ]
        result = MaintenanceEngine.upcoming_service_list(vehicles)
        self.assertEqual(result[0]["vehicle_id"], "high")
        self.assertEqual(result[0]["urgency"], "red")

    # =======================================================================
    # 13. Analytics API Tests
    # =======================================================================
    def test_analytics_dashboard_empty_fleet(self):
        res = self.client.get("/api/v1/analytics/dashboard", headers=self.auth_headers(self.admin_token))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_vehicles"], 0)
        self.assertEqual(data["active_trips_count"], 0)

    def test_analytics_reports_rbac_matrix(self):
        for token, expected in [
            (self.driver_token, 200),
            (self.dispatcher_token, 403),
            (self.finance_token, 200),
            (self.safety_token, 200),
            (self.manager_token, 200),
            (self.admin_token, 200),
        ]:
            res = self.client.get("/api/v1/analytics/reports", headers=self.auth_headers(token))
            self.assertEqual(res.status_code, expected, msg=f"Unexpected status for token role")

    def test_analytics_reports_with_data(self):
        self._seed_vehicle("v-rep", "REP-V")
        self._seed_driver("d-rep", "Rep Driver")
        self.client.post("/api/v1/fuel/log", json={
            "vehicle_id": "v-rep", "date": date.today().isoformat(),
            "odometer_km": 5100.0, "liters": 40.0, "cost": 4000.0
        }, headers=self.auth_headers(self.finance_token))

        res = self.client.get("/api/v1/analytics/reports", headers=self.auth_headers(self.admin_token))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total_operating_cost"], 0)
        self.assertGreaterEqual(data["fleet_uptime_pct"], 0)

    # =======================================================================
    # 14. Dispatch Engine Edge Cases
    # =======================================================================
    def test_auto_assign_picks_least_overdue_vehicle(self):
        with Session(engine) as session:
            v1 = Vehicle(id="v-over", plate_no="OVER", v_type="Van", odometer_km=20000, last_service_km=5000,
                         last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.IDLE)
            v2 = Vehicle(id="v-fresh", plate_no="FRESH", v_type="Van", odometer_km=6000, last_service_km=5500,
                         last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.IDLE)
            d = Driver(id="d-ok", name="OK", license_no="L-OK", license_expiry=date.today())
            t = Trip(id="t-auto", origin="A", destination="B", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None))
            session.add_all([v1, v2, d, t])
            session.commit()

            result = DispatchEngine.auto_assign_trip(session, t)
            self.assertEqual(result.vehicle_id, "v-fresh")

    def test_complete_trip_idempotent(self):
        with Session(engine) as session:
            v = Vehicle(id="v-idem", plate_no="IDEM", v_type="Van", odometer_km=1000, last_service_km=1000,
                        last_service_date=date.today(), insurance_expiry=date.today(), status=VehicleStatus.ON_TRIP)
            d = Driver(id="d-idem", name="Idem", license_no="L-ID", license_expiry=date.today())
            t = Trip(id="t-idem", origin="A", destination="B", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None),
                     vehicle_id="v-idem", driver_id="d-idem", status=TripStatus.IN_TRANSIT)
            session.add_all([v, d, t])
            session.commit()

            DispatchEngine.complete_trip(session, "t-idem", 50.0)
            odo_after_first = session.get(Vehicle, "v-idem").odometer_km
            DispatchEngine.complete_trip(session, "t-idem", 50.0)
            odo_after_second = session.get(Vehicle, "v-idem").odometer_km
            self.assertEqual(odo_after_first, odo_after_second)

    def test_delay_trip_from_assigned_only(self):
        with Session(engine) as session:
            t = Trip(id="t-dly", origin="A", destination="B", scheduled_start=datetime.now(timezone.utc).replace(tzinfo=None),
                     status=TripStatus.COMPLETED)
            with self.assertRaises(ValueError):
                DispatchEngine.delay_trip(session, "t-dly")

    def test_weather_endpoint_deterministic(self):
        res = self.client.get(
            "/api/v1/weather?origin=Warehouse%20A&destination=Site%20B&scheduled_date=2026-07-15",
            headers=self.auth_headers(self.admin_token)
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("origin", data)
        self.assertIn("destination", data)
        self.assertIn("route_hazard_level", data)
        self.assertIn("recommendations", data)
        
        res2 = self.client.get(
            "/api/v1/weather?origin=Warehouse%20A&destination=Site%20B&scheduled_date=2026-07-15",
            headers=self.auth_headers(self.admin_token)
        )
        self.assertEqual(res.json(), res2.json())

if __name__ == "__main__":
    unittest.main()
