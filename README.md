# MedLedger — Secure Healthcare Record Access System

A full-stack starter project for a secure healthcare record access system with role-based access control, built with Node.js, Express, MongoDB, React, and JWT authentication.

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js, Express, MongoDB, Mongoose |
| Auth      | JWT (JSON Web Tokens), bcryptjs     |
| Frontend  | React, React Router v6, Axios       |
| Database  | MongoDB                             |

## Roles

| Role    | Capabilities                                                     |
|---------|------------------------------------------------------------------|
| Admin   | Create doctor accounts, approve patients, view audit logs        |
| Doctor  | Request patient record access, view granted patient records      |
| Patient | Self-register, manage records, grant/revoke doctor access        |

## Project Structure

```
medledger-blockchain/
├── backend/
│   ├── .env.example          # Environment variable template
│   ├── package.json
│   ├── server.js             # Entry point: Express setup + MongoDB + seeding
│   └── src/
│       ├── config/db.js      # MongoDB connection
│       ├── models/
│       │   ├── User.js             # Unified user model (admin/doctor/patient)
│       │   ├── PatientRecord.js    # Medical records
│       │   ├── AccessPermission.js # Doctor-patient access lifecycle
│       │   └── AuditLog.js         # Audit trail (blockchain-ready)
│       ├── middleware/auth.js  # JWT verification + role/approval guards
│       ├── routes/             # auth, admin, doctor, patient
│       └── controllers/        # Business logic for each route group
└── frontend/
    ├── .env.example           # REACT_APP_API_URL
    ├── package.json
    └── src/
        ├── App.js             # Router + AuthProvider
        ├── context/AuthContext.js   # Global auth state
        ├── services/api.js          # Axios + API helper functions
        ├── components/
        │   ├── Navbar.js            # App header with logout
        │   └── PrivateRoute.js      # Auth + role-based route guard
        ├── pages/
        │   ├── Login.js             # Login form
        │   ├── Register.js          # Patient self-registration
        │   ├── AdminDashboard.js    # Manage users + audit logs
        │   ├── DoctorDashboard.js   # Patients + access requests
        │   └── PatientDashboard.js  # Records + access management
        └── styles/App.css           # Responsive global styles
```

## Getting Started

### Prerequisites

- Node.js v16+
- MongoDB (local or Atlas)

### Backend Setup

```bash
cd backend
cp .env.example .env        # Edit with your MongoDB URI and JWT secret
npm install
npm run dev                 # Starts with nodemon on port 5000
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env        # Edit REACT_APP_API_URL if needed
npm install
npm start                   # Starts React dev server on port 3000
```

### Default Admin Account

On first startup, the backend seeds a default admin account:

- **Email:** `admin@medledger.com`
- **Password:** Value of `ADMIN_DEFAULT_PASSWORD` from `.env` (default: `Admin@123`)

## API Endpoints

### Auth (`/api/auth`)
| Method | Path        | Description                    |
|--------|-------------|--------------------------------|
| POST   | `/register` | Patient self-registration      |
| POST   | `/login`    | Login (all roles), returns JWT |

### Admin (`/api/admin`) — requires `admin` role
| Method | Path                     | Description            |
|--------|--------------------------|------------------------|
| GET    | `/users`                 | List all users         |
| POST   | `/doctors`               | Create doctor account  |
| PATCH  | `/users/:id/approve`     | Approve a patient      |
| PATCH  | `/users/:id/deactivate`  | Deactivate a user      |
| GET    | `/audit-logs`            | Get all audit logs     |

### Doctor (`/api/doctor`) — requires `doctor` role + approval
| Method | Path                            | Description                     |
|--------|---------------------------------|---------------------------------|
| GET    | `/patients`                     | List patients with granted access |
| POST   | `/access-requests/:patientId`   | Request access to patient       |
| GET    | `/access-requests`              | View all access requests        |
| GET    | `/patients/:patientId/records`  | View patient records (if access granted) |

### Patient (`/api/patient`) — requires `patient` role + approval
| Method | Path                                | Description                  |
|--------|-------------------------------------|------------------------------|
| GET    | `/records`                          | Get own records              |
| POST   | `/records`                          | Create a new record          |
| GET    | `/access-requests`                  | View incoming access requests |
| PATCH  | `/access-requests/:requestId/grant` | Grant doctor access          |
| PATCH  | `/access-requests/:requestId/revoke`| Revoke doctor access         |

## Audit Logging

Every significant action is logged to the `AuditLog` collection with:
- `action` — e.g., `LOGIN`, `ACCESS_GRANTED`, `RECORD_CREATED`
- `performedBy` — user who performed the action
- `targetUser` — affected user (where applicable)
- `details` — flexible metadata object
- `blockchainTxHash` — `null` by default, ready for future Ethereum smart contract integration

## Environment Variables

### Backend (`.env`)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/medledger
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
ADMIN_DEFAULT_PASSWORD=your_admin_password_here
```

### Frontend (`.env`)
```
REACT_APP_API_URL=http://localhost:5000
```