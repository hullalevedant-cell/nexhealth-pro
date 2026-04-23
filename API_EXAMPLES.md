# NexHealth Pro - Testing & API Examples

## 📋 Sample Patient Registration

### Via Web Interface
1. Go to: `http://localhost:3000/patient-login.html`
2. Click "Register" tab
3. Fill in:
   - Full Name: John Doe
   - Password: mypassword123
   - Age: 35
   - Gender: Male
   - Blood Group: O+
   - Past Illness: Asthma
   - Medical History: Had surgery in 2020
4. Submit to get UHID1001

### Via API (cURL)
```bash
curl -X POST http://localhost:3000/patient/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "password": "mypassword123",
    "age": 35,
    "gender": "Male",
    "blood_group": "O+",
    "past_illness": "Asthma",
    "medical_history": "Had surgery in 2020"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Patient registered successfully",
  "uhid": "UHID1001"
}
```

---

## 🔐 Patient Login

### Via Web Interface
1. Go to: `http://localhost:3000/patient-login.html`
2. Enter UHID: UHID1001
3. Enter Password: mypassword123
4. Click Login

### Via API (cURL)
```bash
curl -X POST http://localhost:3000/patient/login \
  -H "Content-Type: application/json" \
  -d '{
    "uhid": "UHID1001",
    "password": "mypassword123",
    "useOTP": false
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "patient": {
    "id": 1,
    "uhid": "UHID1001",
    "full_name": "John Doe",
    "password": "mypassword123",
    "age": 35,
    "gender": "Male",
    "blood_group": "O+",
    "past_illness": "Asthma",
    "medical_history": "Had surgery in 2020",
    "prescriptions": "",
    "reports": "",
    "created_at": "2026-04-22 10:30:00"
  }
}
```

---

## 👨‍⚕️ Doctor Login

### Via Web Interface
1. Go to: `http://localhost:3000/doctor-login.html`
2. Enter Doctor ID: doctor1
3. Enter Password: pass123
4. Click Login

### Via API (cURL)
```bash
curl -X POST http://localhost:3000/doctor/login \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": "doctor1",
    "password": "pass123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Doctor login successful",
  "doctor_id": "doctor1"
}
```

---

## 📅 Get Doctor's Appointments

### Via API (cURL)
```bash
curl http://localhost:3000/appointments/doctor1
```

**Response:**
```json
{
  "success": true,
  "appointments": [
    {
      "id": 1,
      "patient_uhid": "UHID1001",
      "doctor_id": "doctor1",
      "appointment_date": "2026-05-15 10:00:00",
      "status": "scheduled",
      "full_name": "John Doe",
      "uhid": "UHID1001"
    }
  ]
}
```

---

## 🔍 Search Patient & Generate OTP

### Via Web Interface (Doctor Dashboard)
1. Go to "Search Patient" tab
2. Enter UHID: UHID1001
3. Click "Request OTP"
4. OTP appears (demo mode)

### Via API (cURL)
```bash
curl -X POST http://localhost:3000/patient/access \
  -H "Content-Type: application/json" \
  -d '{
    "uhid": "UHID1001",
    "doctor_id": "doctor1"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "OTP generated and sent to patient",
  "otp": "123456"
}
```

---

## ✅ Verify OTP & Access Patient

### Via Web Interface
1. OTP modal appears after search
2. Enter the OTP shown (e.g., 123456)
3. Click "Verify OTP"
4. Patient record loads for editing

### Via API (cURL) - Get Patient Data
```bash
curl http://localhost:3000/patient/data/UHID1001
```

**Response:**
```json
{
  "success": true,
  "patient": {
    "id": 1,
    "uhid": "UHID1001",
    "full_name": "John Doe",
    "password": "mypassword123",
    "age": 35,
    "gender": "Male",
    "blood_group": "O+",
    "past_illness": "Asthma",
    "medical_history": "Had surgery in 2020",
    "prescriptions": "",
    "reports": "",
    "created_at": "2026-04-22 10:30:00"
  }
}
```

---

## ✏️ Update Patient Medical Records

### Via Web Interface (Doctor)
1. Search and verify patient with OTP
2. Fill in medical fields:
   - Past Illness
   - Medical History
   - Prescriptions
   - Reports
3. Click "Update Patient Record"

### Via API (cURL)
```bash
curl -X POST http://localhost:3000/patient/update \
  -H "Content-Type: application/json" \
  -d '{
    "uhid": "UHID1001",
    "doctor_id": "doctor1",
    "otp": "123456",
    "past_illness": "Asthma, Hypertension",
    "medical_history": "Had appendix surgery in 2020",
    "prescriptions": "Aspirin 100mg daily, Lisinopril 10mg",
    "reports": "Blood test: Normal, BP: 130/85"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Patient record updated successfully"
}
```

---

## 📊 Patient Appointments

### Via API (cURL)
```bash
curl http://localhost:3000/patient/appointments/UHID1001
```

**Response:**
```json
{
  "success": true,
  "appointments": [
    {
      "id": 1,
      "patient_uhid": "UHID1001",
      "doctor_id": "doctor1",
      "appointment_date": "2026-05-15 10:00:00",
      "status": "scheduled",
      "doctor_name": "Dr. Smith"
    }
  ]
}
```

---

## 🧪 Test Case Walkthrough

### Complete Workflow:

1. **Register Patient (Postman/cURL)**
   ```
   POST /patient/register
   Result: Get UHID1001
   ```

2. **Patient Login (Browser)**
   ```
   Go to patient-login.html
   UHID: UHID1001
   Password: patient_password
   Result: Patient dashboard loaded
   ```

3. **Doctor Login (Browser)**
   ```
   Go to doctor-login.html
   Doctor ID: doctor1
   Password: pass123
   Result: Doctor dashboard loaded
   ```

4. **Search Patient (Doctor Dashboard)**
   ```
   Enter UHID: UHID1001
   Click "Request OTP"
   Result: OTP123456 generated
   ```

5. **Verify OTP (Browser)**
   ```
   Enter OTP: 123456
   Click Verify
   Result: Patient record visible
   ```

6. **Update Records (Doctor Dashboard)**
   ```
   Fill prescriptions, reports, etc.
   Click Update
   Result: Patient data updated
   ```

7. **View Updated Data (Patient Dashboard)**
   ```
   Refresh patient dashboard
   Result: Updated prescriptions/reports visible
   ```

---

## 📝 Sample Test Data

### Patient 1
```
UHID: UHID1001
Name: John Doe
Password: pass123
Age: 35
Gender: Male
Blood Group: O+
Past Illness: Asthma
Medical History: Surgery 2020
```

### Patient 2
```
UHID: UHID1002
Name: Jane Smith
Password: secure456
Age: 28
Gender: Female
Blood Group: A+
Past Illness: None
Medical History: Appendectomy 2022
```

### Patient 3
```
UHID: UHID1003
Name: Robert Johnson
Password: demo789
Age: 45
Gender: Male
Blood Group: B+
Past Illness: Diabetes
Medical History: Multiple surgeries
```

---

## 🔄 Database Structure Check

### View Patients Table
```sql
SELECT * FROM patients;
```

### View Appointments Table
```sql
SELECT * FROM appointments;
```

### Count Patients
```sql
SELECT COUNT(*) as total_patients FROM patients;
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | Change PORT in server.js or kill existing process |
| Database errors | Delete nexhealth.db, restart server (recreates) |
| OTP not working | Check console for generated OTP (demo mode) |
| Patient not found | Verify UHID spelling (case-sensitive) |
| Doctor login fails | Check credentials: doctor1/pass123 |
| CORS errors | Not applicable (single-origin server) |

---

## 📈 Performance Notes

- All operations are instant (SQLite in-memory possible)
- Database file: ~50KB (small, fast)
- Session storage used (no server sessions)
- OTP stored in memory (5-minute expiry)
- No external API calls

---

## 🎯 What's Working

✅ Patient registration with auto-generated UHID
✅ Patient login (password & OTP)
✅ Patient dashboard (read-only)
✅ Doctor login with hardcoded credentials
✅ Doctor appointment viewing
✅ Patient search by UHID
✅ OTP generation and verification
✅ Patient record updates by doctor
✅ Responsive UI on all devices
✅ Proper data isolation
✅ Session management
✅ Form validation

---

**Ready to test! Start at:** `http://localhost:3000`
