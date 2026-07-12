from datetime import datetime, date, timedelta, timezone
from statistics import mean, pstdev
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select, and_, or_

from backend.models import Vehicle, Driver, Trip, TripStatus, VehicleStatus, FuelLogEntry, ServiceLogEntry

class SafetyScoreEngine:
    @staticmethod
    def score(d: Driver) -> int:
        base = 100.0
        # -15 per violation
        base -= d.violations * 15.0
        # Overwork penalty: >50 hrs in 7 days is fatigue risk (-1.5 per hour over 50)
        if d.hours_driven_7d > 50:
            base -= (d.hours_driven_7d - 50.0) * 1.5
        # Experience bonus: +0.2 per completed trip, capped at 50 trips
        base += min(d.trips_completed, 50) * 0.2
        # Clamp 0-100
        return max(0, min(100, round(base)))

    @staticmethod
    def badge(score: int) -> str:
        if score >= 85:
            return "Excellent"
        if score >= 65:
            return "Good"
        return "Warning"


class DispatchEngine:
    @staticmethod
    def is_driver_rested(d: Driver, min_gap_hours: float = 8.0) -> bool:
        if d.last_trip_end is None:
            return True
        gap = (datetime.now(timezone.utc).replace(tzinfo=None) - d.last_trip_end).total_seconds() / 3600.0
        return gap >= min_gap_hours

    @staticmethod
    def get_active_trips(session: Session, vehicle_id: str = None, driver_id: str = None) -> List[Trip]:
        query = select(Trip).where(
            Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_TRANSIT])
        )
        if vehicle_id and driver_id:
            query = query.where(or_(Trip.vehicle_id == vehicle_id, Trip.driver_id == driver_id))
        elif vehicle_id:
            query = query.where(Trip.vehicle_id == vehicle_id)
        elif driver_id:
            query = query.where(Trip.driver_id == driver_id)
        
        return session.exec(query).all()

    @classmethod
    def assign_trip(cls, session: Session, trip: Trip, vehicle_id: str, driver_id: str) -> Trip:
        # Conflict checks
        if cls.get_active_trips(session, vehicle_id=vehicle_id):
            raise ValueError(f"Vehicle {vehicle_id} is already assigned to an active trip.")
        
        if cls.get_active_trips(session, driver_id=driver_id):
            raise ValueError(f"Driver {driver_id} is already assigned to an active trip.")
            
        driver = session.get(Driver, driver_id)
        if not driver:
            raise ValueError("Driver not found.")
            
        if not cls.is_driver_rested(driver):
            raise ValueError(f"Driver {driver.name} hasn't completed the mandatory 8-hour rest gap.")
            
        vehicle = session.get(Vehicle, vehicle_id)
        if not vehicle:
            raise ValueError("Vehicle not found.")
            
        if vehicle.status == VehicleStatus.IN_SHOP:
            raise ValueError(f"Vehicle {vehicle.plate_no} is currently In Shop for maintenance.")

        # Update assignment
        trip.vehicle_id = vehicle_id
        trip.driver_id = driver_id
        trip.status = TripStatus.ASSIGNED
        session.add(trip)
        
        # Update vehicle status to ON_TRIP
        vehicle.status = VehicleStatus.ON_TRIP
        session.add(vehicle)
        
        session.commit()
        session.refresh(trip)
        return trip

    @classmethod
    def auto_assign_trip(cls, session: Session, trip: Trip) -> Trip:
        # Get free vehicles: IDLE or ACTIVE status and no active trips
        active_trips = session.exec(
            select(Trip).where(Trip.status.in_([TripStatus.ASSIGNED, TripStatus.IN_TRANSIT]))
        ).all()
        
        assigned_vehicles = {t.vehicle_id for t in active_trips if t.vehicle_id}
        assigned_drivers = {t.driver_id for t in active_trips if t.driver_id}
        
        free_vehicles = session.exec(
            select(Vehicle).where(
                and_(
                    Vehicle.status.in_([VehicleStatus.IDLE, VehicleStatus.ACTIVE]),
                    ~Vehicle.id.in_(list(assigned_vehicles))
                )
            )
        ).all()
        
        all_drivers = session.exec(select(Driver)).all()
        free_drivers = [
            d for d in all_drivers
            if d.id not in assigned_drivers and cls.is_driver_rested(d)
        ]
        
        if not free_vehicles:
            raise ValueError("No available vehicles to dispatch.")
        if not free_drivers:
            raise ValueError("No available rested drivers to dispatch.")
            
        # Rank drivers: highest safety score first
        best_driver = max(free_drivers, key=lambda d: SafetyScoreEngine.score(d))
        
        # Rank vehicles: least mileage since last service first
        best_vehicle = min(free_vehicles, key=lambda v: (v.odometer_km - v.last_service_km))
        
        return cls.assign_trip(session, trip, best_vehicle.id, best_driver.id)

    @classmethod
    def complete_trip(cls, session: Session, trip_id: str, distance_km: float) -> Trip:
        trip = session.get(Trip, trip_id)
        if not trip:
            raise ValueError("Trip not found.")
        if trip.status == TripStatus.COMPLETED:
            return trip
            
        trip.status = TripStatus.COMPLETED
        trip.distance_km = distance_km
        session.add(trip)
        
        # Update vehicle
        if trip.vehicle_id:
            vehicle = session.get(Vehicle, trip.vehicle_id)
            if vehicle:
                vehicle.status = VehicleStatus.IDLE
                vehicle.odometer_km += distance_km
                session.add(vehicle)
                
        # Update driver
        if trip.driver_id:
            driver = session.get(Driver, trip.driver_id)
            if driver:
                driver.trips_completed += 1
                driver.last_trip_end = datetime.now(timezone.utc).replace(tzinfo=None)
                session.add(driver)
                
        session.commit()
        session.refresh(trip)
        return trip

    @classmethod
    def start_trip(cls, session: Session, trip_id: str) -> Trip:
        trip = session.get(Trip, trip_id)
        if not trip:
            raise ValueError("Trip not found.")
        if trip.status not in [TripStatus.ASSIGNED, TripStatus.DELAYED]:
            raise ValueError(f"Cannot start trip from status {trip.status}")
        
        trip.status = TripStatus.IN_TRANSIT
        session.add(trip)
        
        if trip.vehicle_id:
            vehicle = session.get(Vehicle, trip.vehicle_id)
            if vehicle:
                vehicle.status = VehicleStatus.ON_TRIP
                session.add(vehicle)
                
        session.commit()
        session.refresh(trip)
        return trip

    @classmethod
    def delay_trip(cls, session: Session, trip_id: str) -> Trip:
        trip = session.get(Trip, trip_id)
        if not trip:
            raise ValueError("Trip not found.")
        if trip.status not in [TripStatus.ASSIGNED, TripStatus.IN_TRANSIT]:
            raise ValueError(f"Cannot delay trip from status {trip.status}")
            
        trip.status = TripStatus.DELAYED
        session.add(trip)
        session.commit()
        session.refresh(trip)
        return trip

    @classmethod
    def cancel_trip(cls, session: Session, trip_id: str) -> Trip:
        trip = session.get(Trip, trip_id)
        if not trip:
            raise ValueError("Trip not found.")
        if trip.status == TripStatus.COMPLETED:
            raise ValueError("Cannot cancel a completed trip.")
            
        trip.status = TripStatus.CANCELLED
        session.add(trip)
        
        # Free the vehicle
        if trip.vehicle_id:
            vehicle = session.get(Vehicle, trip.vehicle_id)
            if vehicle and vehicle.status == VehicleStatus.ON_TRIP:
                vehicle.status = VehicleStatus.IDLE
                session.add(vehicle)
                
        session.commit()
        session.refresh(trip)
        return trip





class MaintenanceEngine:
    KM_INTERVAL = 10000.0
    DAY_INTERVAL = 180.0
    HOUR_INTERVAL = 500.0

    @classmethod
    def risk_score(cls, v: Vehicle) -> int:
        km_ratio = (v.odometer_km - v.last_service_km) / cls.KM_INTERVAL
        day_ratio = (date.today() - v.last_service_date).days / cls.DAY_INTERVAL
        hour_ratio = v.engine_hours / cls.HOUR_INTERVAL
        
        # worst-of, scaled to 0-100 (capped at 150% overdue = 100 risk)
        worst = max(km_ratio, day_ratio, hour_ratio)
        return round(min(worst, 1.5) / 1.5 * 100.0)

    @classmethod
    def urgency_tag(cls, v: Vehicle) -> str:
        score = cls.risk_score(v)
        if score >= 80:
            return "red"
        if score >= 50:
            return "orange"
        return "green"

    @classmethod
    def upcoming_service_list(cls, vehicles: List[Vehicle]) -> List[Dict[str, Any]]:
        rows = []
        for v in vehicles:
            score = cls.risk_score(v)
            rows.append({
                "vehicle_id": v.id,
                "plate_no": v.plate_no,
                "v_type": v.v_type,
                "odometer_km": v.odometer_km,
                "last_service_km": v.last_service_km,
                "last_service_date": v.last_service_date,
                "engine_hours": v.engine_hours,
                "risk_score": score,
                "urgency": cls.urgency_tag(v)
            })
        # Sort descending by risk score
        return sorted(rows, key=lambda r: -r["risk_score"])


class FuelAnomalyEngine:
    @staticmethod
    def detect_anomalies(fuel_logs: List[FuelLogEntry], z_threshold: float = 2.0) -> List[Dict[str, Any]]:
        """
        Computes the z-score of each fill-up's liters against that vehicle's own mean/stddev.
        Flags fill-ups with |z| >= 2 as a possible fuel-theft/leak anomaly.
        Requires >= 4 fuel logs for a vehicle to build standard deviations.
        """
        anomalies = []
        by_vehicle: Dict[str, List[FuelLogEntry]] = {}
        for e in fuel_logs:
            by_vehicle.setdefault(e.vehicle_id, []).append(e)

        for vid, entries in by_vehicle.items():
            if len(entries) < 4:
                continue
            liters = [e.liters for e in entries]
            mu = mean(liters)
            sigma = pstdev(liters)
            if sigma == 0:
                continue
            for e in entries:
                z = (e.liters - mu) / sigma
                if abs(z) >= z_threshold:
                    anomalies.append({
                        "id": f"{e.vehicle_id}-{e.date}",
                        "vehicle_id": e.vehicle_id,
                        "date": e.date,
                        "liters": e.liters,
                        "cost": e.cost,
                        "odometer_km": e.odometer_km,
                        "mean_liters": round(mu, 2),
                        "z_score": round(z, 2),
                        "message": f"[{e.vehicle_id}] {e.date}: {e.liters}L fill-up is {z:.1f}σ from normal ({mu:.1f}L avg) — review."
                    })
        return anomalies


class ComplianceEngine:
    @staticmethod
    def insurance_alerts(vehicles: List[Vehicle], within_days: int = 30) -> List[Dict[str, Any]]:
        alerts = []
        today = date.today()
        for v in vehicles:
            days_left = (v.insurance_expiry - today).days
            if days_left <= within_days:
                urgency = "EXPIRED" if days_left < 0 else f"{days_left}d left"
                alerts.append({
                    "vehicle_id": v.id,
                    "plate_no": v.plate_no,
                    "days_left": days_left,
                    "urgency": urgency,
                    "message": f"[{v.plate_no}] insurance {urgency} (Expires {v.insurance_expiry})"
                })
        return alerts


class SustainabilityEngine:
    @staticmethod
    def co2_estimate_kg(liters: float) -> float:
        # 2.68 kg CO2 per liter of diesel
        return round(liters * 2.68, 2)
