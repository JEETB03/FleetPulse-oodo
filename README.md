# FleetPulse

**FleetPulse** is a full-stack fleet operations management platform for tracking vehicles, drivers, trips, maintenance, fuel expenses, and analytics — with role-based access control (RBAC) and intelligent dispatch automation.

Built as a modern alternative to traditional ERP/fleet modules (inspired by Odoo-style fleet workflows), FleetPulse provides a real-time **Live Ops Center** dashboard for fleet managers, dispatchers, safety officers, finance analysts, and drivers.

---

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Live KPIs — active trips, fleet utilization, compliance alerts, fuel spend, and sustainability metrics |
| **Vehicles** | Register and manage buses, vans, and trucks with odometer, insurance, and service tracking |
| **Drivers** | Driver profiles with license expiry, violation history, safety scores, and hours-driven tracking |
| **Trips & Dispatch** | Create trips, manual/auto-assign vehicles & drivers, and manage trip lifecycle (start, delay, complete, cancel) |
| **Maintenance** | Service log entries, upcoming maintenance predictions, and overdue service alerts |
| **Fuel & Expenses** | Fuel log tracking with anomaly detection for unusual consumption patterns |
| **Analytics & Reports** | Dashboard analytics and exportable operational reports |
| **Settings & RBAC** | Role-based permissions across all modules |

### Intelligent Engines

FleetPulse includes several backend engines that power smart fleet decisions:

- **SafetyScoreEngine** — Computes driver safety scores (0–100) based on violations, fatigue risk (>50 hrs/7 days), and experience
- **DispatchEngine** — Auto-assigns the best rested driver (highest safety score) and least-overdue vehicle to each trip, with conflict and rest-gap validation
- **MaintenanceEngine** — Predicts upcoming service needs based on km and time since last service
- **FuelAnomalyEngine** — Detects abnormal fuel consumption using statistical deviation analysis
- **ComplianceEngine** — Flags expired or soon-to-expire insurance and license documents
- **SustainabilityEngine** — Tracks fleet carbon footprint and efficiency metrics

### Role-Based Access Control

Six predefined roles with granular module permissions:

| Role | Access |
|------|--------|
| **Admin** | Full access to all modules including settings |
| **Fleet Manager** | Vehicles, drivers, dispatch, maintenance, fuel, reports |
| **Dispatcher** | Trip creation and dispatch operations |
| **Safety Officer** | Driver management and safety reports |
| **Finance Analyst** | Fuel/expense logging and financial reports |
| **Driver** | Read-only access to assigned operations |

---

## Tech Stack

### Backend
- **FastAPI** — High-performance Python API framework
- **SQLModel** — ORM built on SQLAlchemy + Pydantic
- **SQLite** — Lightweight embedded database (configurable via `DATABASE_URL`)
- **JWT Authentication** — Secure token-based auth with bcrypt password hashing
- **Uvicorn** — ASGI server

### Frontend
- **React 18** with **TypeScript**
- **Vite** — Fast dev server and build tool
- **Tailwind CSS** — Utility-first styling
- **React Router v6** — Client-side routing
- **Recharts** — Data visualization
- **Lucide React** — Icon library

### DevOps
- **Docker & Docker Compose** — Containerized deployment for backend and frontend

---

## Project Structure

```
FleetPulse/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── routes.py            # API endpoints (/api/v1)
│   ├── models.py            # SQLModel database models
│   ├── services.py          # Business logic engines
│   ├── auth.py              # JWT auth & RBAC permissions
│   ├── database.py          # Database engine & session
│   ├── seed.py              # Demo data seeder
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile
│   └── test_all_features.py # Integration tests
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Vehicles, Drivers, Trips, etc.
│   │   ├── api.ts           # API client
│   │   ├── App.tsx          # Router & layout shell
│   │   └── main.tsx         # React entry point
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- *(Optional)* Docker & Docker Compose

### Option 1: Run Locally

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

The API will be available at **http://localhost:8000**  
Interactive API docs: **http://localhost:8000/docs**

#### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at **http://localhost:5173**

### Option 2: Run with Docker Compose

```bash
docker-compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Demo Credentials

The database is automatically seeded on first startup with demo users. All accounts use the password **`password123`**.

| Role | Email |
|------|-------|
| Admin | admin@fleetpulse.com |
| Fleet Manager | manager@fleetpulse.com |
| Dispatcher | dispatcher@fleetpulse.com |
| Safety Officer | safety@fleetpulse.com |
| Finance Analyst | finance@fleetpulse.com |
| Driver | driver@fleetpulse.com |

Use the **Active Persona** dropdown in the header to instantly switch between roles without re-logging in.

---

## API Reference

All endpoints are prefixed with `/api/v1` and require a Bearer token (except auth routes).

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register a new user |
| POST | `/auth/login` | Login and receive JWT token |
| POST | `/auth/token` | OAuth2 token endpoint |

### Vehicles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vehicles` | List all vehicles |
| POST | `/vehicles` | Create a vehicle |
| PATCH | `/vehicles/{id}` | Update a vehicle |
| GET | `/vehicles/{id}/history` | Trip, service, and fuel history |

### Drivers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/drivers` | List drivers with safety scores |
| POST | `/drivers` | Create a driver |

### Trips & Dispatch

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/trips` | List all trips |
| POST | `/trips` | Create a trip |
| POST | `/trips/{id}/assign` | Manually assign vehicle & driver |
| POST | `/trips/{id}/auto-assign` | Auto-assign best available resources |
| POST | `/trips/{id}/start` | Mark trip as in transit |
| POST | `/trips/{id}/delay` | Mark trip as delayed |
| POST | `/trips/{id}/complete` | Complete trip and update odometer |
| POST | `/trips/{id}/cancel` | Cancel a trip |

### Maintenance & Fuel

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/maintenance/upcoming` | Upcoming/overdue maintenance alerts |
| POST | `/maintenance/log` | Log a service entry |
| GET | `/fuel` | List fuel log entries |
| POST | `/fuel/log` | Log a fuel entry |
| GET | `/fuel/anomalies` | Detected fuel consumption anomalies |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/dashboard` | Dashboard KPIs and metrics |
| GET | `/analytics/reports` | Detailed operational reports |

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```env
# Backend
DATABASE_URL=sqlite:///./fleetpulse.db
SECRET_KEY=your-secret-key-here

# Frontend
VITE_API_URL=http://localhost:8000
```

> **Note:** Change `SECRET_KEY` before deploying to production.

---

## Running Tests

```bash
cd backend
python test_all_features.py
```

This runs integration tests covering authentication, CRUD operations, dispatch logic, maintenance predictions, fuel anomaly detection, and analytics.

---

## Screenshots

The FleetPulse UI features a dark-themed **Live Ops Center** with:

- Sidebar navigation across all fleet modules
- Real-time dashboard with charts and KPI cards
- Persona switcher for instant RBAC demo
- Compliance and maintenance alert badges

---

## License

This project is open source. Feel free to use, modify, and distribute.

---

## Author

**[JEETB03](https://github.com/JEETB03)**
