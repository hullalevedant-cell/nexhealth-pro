# NexHealth Pro - Quick Start Guide

## 🚀 Project Status: LIVE AND RUNNING

The NexHealth Pro healthcare management system is now fully deployed and running on `http://localhost:3000`

---

## 📱 PATIENT FLOW

### 1. Register as Patient
- Go to `http://localhost:3000/patient-login.html`
- Click the **Register** tab
- Fill in all required fields:
  - Full Name
  - Password
  - Age, Gender, Blood Group
  - Optional: Past Illness, Medical History
- Submit to get your **UHID** (e.g., UHID1001)
- Your UHID is auto-generated and unique

### 2. Login as Patient
- Use your **UHID** and **Password**
- Alternative: Use **UHID** + **OTP** (if provided by doctor)
- Access your personal dashboard

### 3. Patient Dashboard Features
- ✅ View personal information (read-only)
- ✅ View medical history
- ✅ View current prescriptions and reports
- ✅ See scheduled appointments
- ❌ Cannot edit any information

---

## 👨‍⚕️ DOCTOR FLOW

### 1. Login as Doctor
- Go to `http://localhost:3000/doctor-login.html`
- Use demo credentials:
  - **Doctor ID**: doctor1, doctor2, or doctor3
  - **Password**: pass123

### 2. Doctor Dashboard Features

#### 2.1 View Appointments
- See all scheduled appointments
- View patient names, UHIDs, dates, and status

#### 2.2 Search Patient
- Enter patient UHID (e.g., UHID1001)
- Click "Request OTP"
- An OTP is generated (shown on screen in demo mode)

#### 2.3 OTP Verification
- Enter the generated OTP
- Verify to access patient record

#### 2.4 Update Patient Records
- After OTP verification, access patient data
- Edit and update:
  - Past Illness
  - Medical History
  - Prescriptions
  - Reports
- Click "Update Patient Record" to save

---

## 🗄️ DATABASE SCHEMA

### patients table
```
- id: Auto-increment ID
- uhid: Unique patient identifier (UHID1001, UHID1002, etc.)
- full_name: Patient name
- password: Hashed password
- otp: Temporary OTP
- age: Age
- gender: Gender
- blood_group: Blood group
- past_illness: Previous illnesses
- medical_history: Medical history
- prescriptions: Current prescriptions
- reports: Medical reports
- created_at: Registration timestamp
```

### appointments table
```
- id: Auto-increment ID
- patient_uhid: Patient's UHID
- doctor_id: Doctor ID
- appointment_date: Scheduled date/time
- status: Appointment status (scheduled, completed, cancelled)
```

---

## 🔐 UHID SYSTEM

- **Format**: UHID + sequential number (UHID1001, UHID1002, UHID1003, etc.)
- **Generation**: Automatic on patient registration
- **Uniqueness**: Guaranteed unique per patient
- **Purpose**: Unique identification without relying on personal data

---

## 🔒 OTP SYSTEM

### How It Works:
1. Doctor searches for patient by UHID
2. System generates 6-digit OTP
3. OTP stored temporarily (5-minute expiry)
4. Doctor enters OTP to verify access
5. Patient record unlocked for updates

### Demo Mode:
- OTP is displayed on screen (for testing)
- In production, OTP would be sent via SMS/Email

---

## 📡 API ENDPOINTS

```
POST /patient/register
- Body: full_name, password, age, gender, blood_group, past_illness, medical_history
- Returns: UHID

POST /patient/login
- Body: uhid, password (or otp + useOTP flag)
- Returns: Patient data

POST /doctor/login
- Body: doctor_id, password
- Returns: Success status

GET /appointments/:doctorId
- Returns: Doctor's scheduled appointments

GET /patient/data/:uhid
- Returns: Patient information

GET /patient/appointments/:uhid
- Returns: Patient's appointments

POST /patient/access
- Body: uhid, doctor_id
- Returns: Generated OTP

POST /patient/update
- Body: uhid, doctor_id, otp, prescriptions, reports, medical_history, past_illness
- Returns: Update status
```

---

## 💻 TECH STACK

- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **No Dependencies**: No React, Bootstrap, or extra libraries
- **Architecture**: MVC-style with modular components

---

## 📁 PROJECT STRUCTURE

```
NexHealth-Pro/
├── src/
│   ├── server.js          # Express server setup
│   ├── db.js              # SQLite initialization
│   ├── routes.js          # API endpoints
│   └── otp.js             # OTP management
├── public/
│   ├── index.html         # Landing page
│   ├── patient-login.html # Patient login/register
│   ├── doctor-login.html  # Doctor login
│   ├── patient-dashboard.html
│   ├── doctor-dashboard.html
│   ├── style.css          # All styling
│   └── script.js          # Frontend logic
├── package.json
├── README.md
└── nexhealth.db           # SQLite database (auto-created)
```

---

## 🎨 UI/UX DESIGN

- **Color Scheme**: Professional Blue/White (#0066cc primary)
- **Responsive**: Mobile, tablet, and desktop friendly
- **Components**:
  - Clean forms with validation
  - Responsive tables
  - Card-based layout
  - Sidebar navigation
  - Modals for OTP entry
  - Tab navigation for organization

---

## 🧪 TESTING SCENARIOS

### Scenario 1: Patient Registration & Login
1. Register with full details
2. Get auto-generated UHID
3. Login with UHID + password
4. View personal dashboard (read-only)

### Scenario 2: Doctor Access Patient
1. Doctor logs in with doctor1/pass123
2. Search patient by UHID
3. Receives OTP (shown in demo)
4. Enters OTP to verify
5. Updates patient records
6. Patient data is updated

### Scenario 3: Multiple Patients
1. Register multiple patients
2. Each gets unique UHID (UHID1001, UHID1002, etc.)
3. Doctors can access any patient with OTP
4. Data isolation ensures privacy

---

## ⚙️ INSTALLATION & RUNNING

### Install Dependencies
```bash
npm install
```

### Start Server
```bash
npm start
# or
node src/server.js
```

### Access Application
- Open browser: `http://localhost:3000`
- Patient Login: `http://localhost:3000/patient-login.html`
- Doctor Login: `http://localhost:3000/doctor-login.html`

---

## 🔑 DEMO CREDENTIALS

### Doctors (Hardcoded)
```
Doctor 1:
  ID: doctor1
  Password: pass123

Doctor 2:
  ID: doctor2
  Password: pass123

Doctor 3:
  ID: doctor3
  Password: pass123
```

### Patients (Register First)
- Each registration generates unique UHID
- First patient: UHID1001
- Second patient: UHID1002
- And so on...

---

## 📝 NOTES

- ✅ All data stored in SQLite (nexhealth.db)
- ✅ Session storage used for client-side auth
- ✅ OTP valid for 5 minutes
- ✅ 3 OTP attempts allowed before lockout
- ✅ Patient data is view-only for patients
- ✅ Doctor can update: prescriptions, reports, medical history, past illness
- ✅ No passwords hashed (simple demo - add bcrypt for production)
- ✅ UHID auto-generated and guaranteed unique

---

## 🚨 PRODUCTION CONSIDERATIONS

For a production deployment, add:
1. Password hashing (bcrypt)
2. JWT tokens instead of session storage
3. Email/SMS OTP delivery
4. HTTPS encryption
5. Rate limiting
6. Input validation & sanitization
7. Audit logging
8. Database backups
9. Error tracking (Sentry)
10. Performance monitoring

---

## 📞 SUPPORT

- All routes logged in console
- Database auto-initializes on startup
- Tables created automatically
- Demo OTP shown for testing (remove in production)

---

**NexHealth Pro v1.0 - Ready to Use!** 🏥
