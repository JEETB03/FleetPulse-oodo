# FleetPulse

FleetPulse is a fleet operations management MVP for teams that need a single place to manage vehicles, drivers, trips, maintenance, fuel spend, reporting, and role-based access control.

It is designed to solve a simple but common problem: fleet data is usually scattered across spreadsheets, manual approvals, and disconnected tools. That creates blind spots in dispatch, maintenance, fuel control, and compliance. FleetPulse brings those workflows into one data-driven system so operators can see what is happening, act faster, and make decisions from live records instead of hardcoded demo data.

## What Problem It Solves

Most small and mid-sized fleet teams face the same issues:

- Vehicle, driver, and trip data live in separate places.
- Maintenance and insurance tracking depends on manual follow-up.
- Fuel usage and operating cost anomalies are hard to spot early.
- Different roles need different access, but permission rules are often inconsistent.
- Dashboards look good in demos but do not reflect real backend data.

FleetPulse addresses that by making the backend the source of truth for fleet records, permissions, and analytics.

## Why We Built It

This project started as a demo-heavy fleet app, but the goal now is a real MVP foundation that can grow into a production system.

We are solving for:

- a data-driven user experience rather than hardcoded UI state,
- admin-controlled RBAC so access rules can be edited safely,
- backend-owned analytics and reports,
- a structure that can later support onboarding, imports, and offline operations.

## What It Does

FleetPulse currently provides:

- real-time dashboard KPIs for fleet status, active trips, compliance, and fuel anomalies,
- vehicle registry with service, insurance, and odometer tracking,
- driver profiles with safety scoring and fatigue awareness,
- trip dispatch with lifecycle actions like start, delay, complete, and cancel,
- maintenance logging and overdue risk monitoring,
- fuel expense tracking with anomaly detection,
- reports and analytics driven by backend aggregates,
- admin-editable permission matrix for role-based access control.

## How It Works

FleetPulse is structured as a simple full-stack application:

- The backend stores operational data in SQLite through SQLModel.
- FastAPI exposes the APIs used by the frontend.
- The frontend React app reads live data from those APIs.
- Authentication uses JWT tokens and bcrypt password hashing.
- RBAC rules are persisted in the database and editable by Admin users.
- Seed data exists only as bootstrap/demo data so the app can start quickly in development.

### Core Data Flow

1. A user logs in through the frontend.
2. The backend validates credentials and returns a JWT token.
3. The frontend uses the token for all API requests.
4. Dashboard, vehicles, drivers, trips, fuel, reports, and settings all render backend-owned data.
5. Admin users can edit the permission matrix from Settings.

## Current MVP Scope

The app currently covers:

- authentication and session storage,
- fleet entity management,
- dispatch and trip lifecycle operations,
- maintenance and fuel logging,
- operational analytics,
- role-based permissions,
- seeded demo data for development and review.

## What Is No Longer Hardcoded

The app has been moved away from frontend-only demo state in the most important places:

- the permission matrix now lives in the backend,
- Settings reads and edits permissions through API calls,
- user lists are backend-sourced,
- analytics and reports are computed from stored records,
- role-based access checks are tied to persisted permission data.

## Future Scope

Planned next step:

- offline scheduling support.

That would allow trip planning and dispatch preparation even when the device is temporarily disconnected, then sync changes back once connectivity returns. A good future implementation would likely include local queueing, conflict resolution, and a clear sync status view.

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Optional: Docker and Docker Compose

### Run Locally

#### 1. Clone the repository

```bash
git clone https://github.com/JEETB03/FleetPulse-oodo.git
cd FleetPulse-oodo
```

#### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
python -m backend.main
```

The API will be available at `http://localhost:8000`

Interactive docs will be available at `http://localhost:8000/docs`

#### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:5173`

### Run With Docker Compose

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

## Demo Credentials

The database is seeded on first startup with demo users for development and review.

All demo accounts use the password `password123`.

| Role | Email |
|---|---|
| Admin | admin@fleetpulse.com |
| Fleet Manager | manager@fleetpulse.com |
| Dispatcher | dispatcher@fleetpulse.com |
| Safety Officer | safety@fleetpulse.com |
| Finance Analyst | finance@fleetpulse.com |
| Driver | driver@fleetpulse.com |

## API Reference

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Register a new user |
| POST | `/auth/login` | Login and receive a JWT token |
| POST | `/auth/token` | OAuth2 token endpoint |

### Users and Settings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | Admin-only user directory |
| GET | `/settings/permissions` | Fetch permission matrix |
| PUT | `/settings/permissions` | Update permission matrix |

### Vehicles

| Method | Endpoint | Description |
|---|---|---|
| GET | `/vehicles` | List all vehicles |
| POST | `/vehicles` | Create a vehicle |
| PATCH | `/vehicles/{id}` | Update a vehicle |
| GET | `/vehicles/{id}/history` | Vehicle history, trips, service, and fuel |

### Drivers

| Method | Endpoint | Description |
|---|---|---|
| GET | `/drivers` | List drivers with safety scores |
| POST | `/drivers` | Create a driver |

### Trips and Dispatch

| Method | Endpoint | Description |
|---|---|---|
| GET | `/trips` | List all trips |
| POST | `/trips` | Create a trip |
| POST | `/trips/{id}/assign` | Manually assign vehicle and driver |
| POST | `/trips/{id}/auto-assign` | Auto-assign best available resources |
| POST | `/trips/{id}/start` | Mark trip as in transit |
| POST | `/trips/{id}/delay` | Mark trip as delayed |
| POST | `/trips/{id}/complete` | Complete a trip and update odometer |
| POST | `/trips/{id}/cancel` | Cancel a trip |

### Maintenance and Fuel

| Method | Endpoint | Description |
|---|---|---|
| GET | `/maintenance/upcoming` | Upcoming and overdue maintenance alerts |
| POST | `/maintenance/log` | Log a service entry |
| GET | `/fuel` | List fuel logs |
| POST | `/fuel/log` | Log a fuel entry |
| GET | `/fuel/anomalies` | Fuel anomaly detection results |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/dashboard` | Dashboard KPIs and alert summaries |
| GET | `/analytics/reports` | Operational reporting aggregates |

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

```env
# Backend
DATABASE_URL=sqlite:///./fleetpulse.db
SECRET_KEY=your-secret-key-here

# Frontend
VITE_API_URL=http://localhost:8000
```

Important: change `SECRET_KEY` before deploying to production.

## Running Tests

```bash
cd backend
python test_all_features.py
```

This test suite covers authentication, CRUD operations, dispatch logic, maintenance predictions, fuel anomaly detection, and analytics.

## Screenshots

FleetPulse uses a dark-themed Live Ops Center layout with:

- a persistent sidebar for fleet modules,
- KPI cards and operational charts,
- tables and forms for live fleet data,
- admin-only settings for permission management,
- read-only state where role access does not permit edits.

## License

This project is open source. Feel free to use, modify, and distribute.

## Author

**[JEETB03](https://github.com/JEETB03)**

## Tech Stack

### Backend
- FastAPI
- SQLModel
- SQLite
- JWT authentication
- bcrypt password hashing
- Uvicorn

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Recharts
- Lucide React

### DevOps
- Docker
- Docker Compose
