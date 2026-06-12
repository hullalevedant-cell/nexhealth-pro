# NexHealth Pro - Healthcare Management System

A simple, professional healthcare management system built with Node.js, Express, SQLite, HTML, CSS, and Vanilla JavaScript.

## Features

- **Patient Login**: Register and login with UHID and password/OTP
- **Doctor Login**: Secure doctor access with hardcoded credentials
- **Patient Dashboard**: View-only access to personal medical records
- **Doctor Dashboard**: Search patients, update medical records with OTP verification
- **UHID System**: Auto-generated unique patient identifiers
- **OTP Verification**: Security layer for doctor-patient access

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (primary storage)
- **Optional PostgreSQL**: supported via `DATABASE_URL` for Supabase
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **No external frontend frameworks**: Bootstrap, React, or similar

## Installation

```bash
npm install
```

## Running the Project

```bash
npm start
```

The application will run on `http://localhost:5000` by default.

## Environment Variables

If you want to enable PostgreSQL/Supabase support, create a `.env` file in the project root with:

```bash
DATABASE_URL=your-postgres-connection-url
```

The app will still use SQLite for existing functionality even when PostgreSQL is enabled.

## Default Doctor Credentials

```
Doctor 1: doctor1 / pass123
Doctor 2: doctor2 / pass123
Doctor 3: doctor3 / pass123
```

## New PostgreSQL Test Route

- `GET /test-db` - runs `SELECT NOW()` against PostgreSQL and returns the current database time.

This route is only available when `DATABASE_URL` is configured.

## Project Structure

```
NexHealth-Pro/
├── src/
│   ├── server.js          # Express server and middleware
│   ├── db.js              # SQLite database initialization
│   ├── db_postgres.js     # PostgreSQL/Supabase connection pool
│   ├── routes.js          # API routes
│   └── otp.js             # OTP management
├── public/
│   ├── index.html
│   ├── patient-login.html
│   ├── doctor-login.html
│   ├── patient-dashboard.html
│   ├── doctor-dashboard.html
│   ├── style.css
│   └── script.js
├── package.json
└── README.md
```

## Database

### SQLite

The application still uses SQLite for all core patient and appointment data.

- **patients** table: Patient records, medical history, prescriptions, reports
- **appointments** table: Appointment scheduling and management

### PostgreSQL / Supabase

A separate PostgreSQL pool is available in `src/db_postgres.js`. This is only used by the `/test-db` route for validation and does not replace SQLite.

## API Routes

- `POST /patient/register` - Patient registration (SQLite)
- `POST /patient/login` - Patient login (SQLite)
- `POST /doctor/login` - Doctor login
- `GET /appointments/:doctorId` - Get doctor's appointments (SQLite)
- `POST /patient/access` - Verify OTP and access patient record (SQLite)
- `POST /patient/update` - Update patient medical records (SQLite)
- `GET /test-db` - Test PostgreSQL connection with `SELECT NOW()`

## Features in Detail

### Patient Side
- Register with full medical information
- Login with UHID and password or OTP
- View personal medical records (read-only)
- View scheduled appointments
- Cannot edit any information

### Doctor Side
- Login with doctor ID and password
- View scheduled appointments
- Search for patient by UHID
- Request OTP for patient access
- Update patient prescriptions, reports, medical history, and past illness
- Secure access control with OTP verification

## Notes

- Do not remove or replace SQLite logic unless you are ready to fully migrate.
- PostgreSQL support is added minimally and modularly.
- Frontend remains unchanged.
