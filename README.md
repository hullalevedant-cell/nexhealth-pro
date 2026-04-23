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
- **Database**: SQLite3
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **No external dependencies**: Bootstrap, React, or frontend libraries

## Installation

```bash
npm install
```

## Running the Project

```bash
npm start
```

The application will run on `http://localhost:3000`

## Default Doctor Credentials

```
Doctor 1: doctor1 / pass123
Doctor 2: doctor2 / pass123
Doctor 3: doctor3 / pass123
```

## Project Structure

```
NexHealth-Pro/
├── src/
│   ├── server.js          # Express server
│   ├── db.js              # Database initialization
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

The application automatically creates SQLite database with:
- **patients** table: Patient records, medical history, prescriptions, reports
- **appointments** table: Appointment scheduling and management

## API Routes

- `POST /patient/register` - Patient registration
- `POST /patient/login` - Patient login
- `POST /doctor/login` - Doctor login
- `GET /appointments/:doctorId` - Get doctor's appointments
- `POST /patient/access` - Verify OTP and access patient record
- `POST /patient/update` - Update patient medical records

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
