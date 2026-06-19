const express = require('express');
const router = express.Router();
const { db } = require('./db');
const pgPool = require('./db_postgres');
const otpModule = require('./otp');
const emailOtp = require('./email_otp');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');

// SQLite is used for patients, appointments, and main application data.
// PostgreSQL is configured separately in src/db_postgres.js and only used by /test-db.

let pgPatientsTableReady = false;
let pgDoctorsTableReady = false;
let pgMedicalTablesReady = false;
let supabaseBucketReady = false;

const PHOTO_BUCKET = 'patient-photos';
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const mimeType = (file.mimetype || '').toLowerCase();
    if (ALLOWED_IMAGE_EXTENSIONS.includes(ext) && ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      return cb(null, true);
    }
    return cb(new Error('Only JPG, JPEG, and PNG files are allowed'));
  }
});

function runSinglePhotoUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'patientPhoto', maxCount: 1 }])(req, res, (err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are missing');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function ensureSupabasePhotoBucket() {
  if (supabaseBucketReady) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_PHOTO_SIZE_BYTES}`,
    allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES
  });
  if (error && !String(error.message || '').toLowerCase().includes('already')) {
    throw error;
  }
  supabaseBucketReady = true;
}

async function uploadPatientPhoto(fileBuffer, originalName, mimeType, uhid) {
  await ensureSupabasePhotoBucket();
  const supabase = getSupabaseClient();
  const fileExt = (originalName.split('.').pop() || '').toLowerCase();
  const filePath = `${uhid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false
    });
  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function ensurePgPatientsTable() {
  if (!pgPool) {
    throw new Error('Postgres not configured');
  }

  if (pgPatientsTableReady) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      uhid TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      email TEXT,
      past_illness TEXT DEFAULT '',
      medical_history TEXT DEFAULT '',
      prescriptions TEXT DEFAULT '',
      reports TEXT DEFAULT '',
      aadhaar_number VARCHAR(20),
      photo_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pgPool.query(`
    ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20)
  `);

  await pgPool.query(`
    ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS photo_url TEXT
  `);

  await pgPool.query(`
    ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS email TEXT
  `);

  pgPatientsTableReady = true;
}

async function getNextPgUHID() {
  await ensurePgPatientsTable();
  const result = await pgPool.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(uhid FROM 5) AS INTEGER)), 1000) AS max_num
    FROM patients
    WHERE uhid ~ '^UHID[0-9]+$'
  `);

  const nextNum = (result.rows[0]?.max_num || 1000) + 1;
  return `UHID${nextNum}`;
}

async function ensurePgDoctorsTable() {
  if (!pgPool) {
    throw new Error('Postgres not configured');
  }

  if (pgDoctorsTableReady) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY,
      doctor_id TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      specialization TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed default doctor records without changing existing API behavior.
  await pgPool.query(`
    INSERT INTO doctors (doctor_id, password, full_name, specialization)
    VALUES
      ('doctor1', 'pass123', 'Dr. Smith', 'General Medicine'),
      ('doctor2', 'pass123', 'Dr. Johnson', 'General Medicine'),
      ('doctor3', 'pass123', 'Dr. Williams', 'General Medicine')
    ON CONFLICT (doctor_id) DO NOTHING
  `);

  pgDoctorsTableReady = true;
}

async function getDoctorByIdAndPassword(doctorId, password) {
  await ensurePgDoctorsTable();
  const result = await pgPool.query(
    'SELECT doctor_id, full_name, specialization FROM doctors WHERE doctor_id = $1 AND password = $2',
    [doctorId, password]
  );
  return result.rows[0] || null;
}

async function getDoctorById(doctorId) {
  await ensurePgDoctorsTable();
  const result = await pgPool.query(
    'SELECT doctor_id, full_name, specialization FROM doctors WHERE doctor_id = $1',
    [doctorId]
  );
  return result.rows[0] || null;
}

async function ensurePgMedicalTables() {
  if (!pgPool) {
    throw new Error('Postgres not configured');
  }

  if (pgMedicalTablesReady) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS medical_records (
      id SERIAL PRIMARY KEY,
      patient_uhid TEXT UNIQUE NOT NULL,
      medical_history TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id SERIAL PRIMARY KEY,
      patient_uhid TEXT UNIQUE NOT NULL,
      prescriptions TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      patient_uhid TEXT UNIQUE NOT NULL,
      reports TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS illness_history (
      id SERIAL PRIMARY KEY,
      patient_uhid TEXT UNIQUE NOT NULL,
      past_illness TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  pgMedicalTablesReady = true;
}

async function upsertMedicalField(tableName, columnName, patientUhid, value) {
  await ensurePgMedicalTables();
  const query = `
    INSERT INTO ${tableName} (patient_uhid, ${columnName}, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (patient_uhid)
    DO UPDATE SET ${columnName} = EXCLUDED.${columnName}, updated_at = NOW()
  `;
  await pgPool.query(query, [patientUhid, value]);
}

async function getPatientMedicalSnapshot(patientUhid) {
  await ensurePgMedicalTables();
  const result = await pgPool.query(
    `
      SELECT
        COALESCE(mr.medical_history, '') AS medical_history,
        COALESCE(pr.prescriptions, '') AS prescriptions,
        COALESCE(rp.reports, '') AS reports,
        COALESCE(ih.past_illness, '') AS past_illness
      FROM (SELECT $1::text AS patient_uhid) base
      LEFT JOIN medical_records mr ON mr.patient_uhid = base.patient_uhid
      LEFT JOIN prescriptions pr ON pr.patient_uhid = base.patient_uhid
      LEFT JOIN reports rp ON rp.patient_uhid = base.patient_uhid
      LEFT JOIN illness_history ih ON ih.patient_uhid = base.patient_uhid
    `,
    [patientUhid]
  );
  return result.rows[0] || {
    medical_history: '',
    prescriptions: '',
    reports: '',
    past_illness: ''
  };
}

async function getPatientSessionPayload(patientUhid) {
  await ensurePgPatientsTable();
  const result = await pgPool.query('SELECT * FROM patients WHERE uhid = $1', [patientUhid]);
  const patient = result.rows[0];
  if (!patient) {
    return null;
  }

  const medicalSnapshot = await getPatientMedicalSnapshot(patientUhid);
  return { ...patient, ...medicalSnapshot };
}

function getDoctorAccessResponse(doctorId, uhid) {
  return emailOtp.getDoctorAccessGrant({ doctorId, uhid });
}

async function ensureDoctorCanAccessPatient(res, doctorId, uhid) {
  if (!doctorId || !uhid) {
    res.status(400).json({ success: false, message: 'UHID and Doctor ID required' });
    return null;
  }

  const doctor = await getDoctorById(doctorId);
  if (!doctor) {
    res.status(400).json({ success: false, message: 'Invalid doctor' });
    return null;
  }

  const access = getDoctorAccessResponse(doctorId, uhid);
  if (!access.ok) {
    res.status(access.status || 403).json({ success: false, message: access.message });
    return null;
  }

  return access;
}

// POST /patient/register
router.post('/patient/register', async (req, res) => {
  try {
    await runSinglePhotoUpload(req, res);
    const { full_name, password, age, gender, blood_group, past_illness, medical_history, email } = req.body;
    const aadhaar_number = req.body.aadhaar_number || req.body.aadhaarNumber;
    const patientPhoto = (req.files && ((req.files.photo && req.files.photo[0]) || (req.files.patientPhoto && req.files.patientPhoto[0]))) || null;

    const normalized = {
      full_name: String(full_name || '').trim(),
      password: String(password || '').trim(),
      email: String(email || '').trim(),
      gender: String(gender || '').trim(),
      blood_group: String(blood_group || '').trim(),
      aadhaar_number: String(aadhaar_number || '').trim()
    };
    const parsedAge = Number(age);

    const missingFields = [];
    if (!normalized.full_name) missingFields.push('full_name');
    if (!normalized.password) missingFields.push('password');
    if (!normalized.email) missingFields.push('email');
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) missingFields.push('age');
    if (!normalized.gender) missingFields.push('gender');
    if (!normalized.blood_group) missingFields.push('blood_group');
    if (!normalized.aadhaar_number) missingFields.push('aadhaar_number');
    if (!patientPhoto) missingFields.push('photo');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    if (!/^\d{12}$/.test(normalized.aadhaar_number)) {
      return res.status(400).json({ success: false, message: 'Aadhaar number must be exactly 12 digits' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    await ensurePgPatientsTable();

    let attempts = 0;
    let uhid = null;

    while (attempts < 3) {
      attempts += 1;
      uhid = await getNextPgUHID();

      try {
        const photoUrl = await uploadPatientPhoto(
          patientPhoto.buffer,
          patientPhoto.originalname,
          patientPhoto.mimetype,
          uhid
        );

        await pgPool.query(
          `
            INSERT INTO patients (
              uhid, full_name, password, age, gender, blood_group, email, past_illness, medical_history, prescriptions, reports, aadhaar_number, photo_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '', '', $10, $11)
          `,
          [
            uhid,
            normalized.full_name,
            normalized.password,
            parsedAge,
            normalized.gender,
            normalized.blood_group,
            normalized.email,
            past_illness || '',
            medical_history || '',
            normalized.aadhaar_number,
            photoUrl
          ]
        );

        await upsertMedicalField('illness_history', 'past_illness', uhid, past_illness || '');
        await upsertMedicalField('medical_records', 'medical_history', uhid, medical_history || '');
        await upsertMedicalField('prescriptions', 'prescriptions', uhid, '');
        await upsertMedicalField('reports', 'reports', uhid, '');

        return res.json({ success: true, message: 'Patient registered successfully', uhid });
      } catch (insertError) {
        if (insertError.code === '23505' && attempts < 3) {
          continue;
        }
        throw insertError;
      }
    }

    return res.status(500).json({ success: false, message: 'Error generating UHID' });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Photo must be 5MB or smaller' });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes('Only JPG, JPEG, and PNG')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes('Supabase environment variables are missing')) {
      return res.status(500).json({
        success: false,
        message: 'Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      });
    }
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND'
    ) {
      return res.status(503).json({
        success: false,
        message: 'Database connection failed. Check DATABASE_URL and network access to PostgreSQL.'
      });
    }
    console.error('Registration exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/login
router.post('/patient/login', async (req, res) => {
  try {
    const { uhid, password, useOTP, otp } = req.body;

    if (!uhid) {
      return res.status(400).json({ success: false, message: 'UHID is required' });
    }

    await ensurePgPatientsTable();

    // Check if using OTP or password
    if (useOTP && otp) {
      const otpVerification = otpModule.verifyOTP(uhid, otp);
      if (!otpVerification.valid) {
        return res.status(400).json({ success: false, message: otpVerification.message });
      }
      const responsePatient = await getPatientSessionPayload(uhid);
      if (!responsePatient) {
        return res.status(400).json({ success: false, message: 'Patient not found' });
      }
      return res.json({ success: true, message: 'Login successful via OTP', patient: responsePatient });
    } else if (password) {
      const result = await pgPool.query('SELECT * FROM patients WHERE uhid = $1 AND password = $2', [uhid, password]);
      const patient = result.rows[0];
      if (!patient) {
        return res.status(400).json({ success: false, message: 'Invalid UHID or password' });
      }
      const responsePatient = await getPatientSessionPayload(uhid);
      return res.json({ success: true, message: 'Login successful', patient: responsePatient });
    } else {
      return res.status(400).json({ success: false, message: 'Password or OTP required' });
    }
  } catch (error) {
    console.error('Login exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/email-otp/send
router.post('/patient/email-otp/send', async (req, res) => {
  try {
    const { uhid } = req.body;
    if (!uhid) {
      return res.status(400).json({ success: false, message: 'UHID is required' });
    }

    await ensurePgPatientsTable();
    const result = await pgPool.query(
      'SELECT uhid, full_name, email FROM patients WHERE uhid = $1',
      [uhid]
    );
    const patient = result.rows[0];
    if (!patient) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }

    const sendResult = await emailOtp.sendEmailOtp({
      uhid: patient.uhid,
      email: patient.email,
      name: patient.full_name
    });

    if (!sendResult.ok) {
      return res.status(sendResult.status || 400).json({ success: false, message: sendResult.message });
    }

    return res.json({
      success: true,
      message: `OTP sent to ${sendResult.maskedEmail}`,
      expiresInMinutes: 5
    });
  } catch (error) {
    console.error('Email OTP send exception:', {
      message: error.message,
      code: error.code || null,
      stack: error.stack
    });
    if (String(error.message || '').includes('RESEND_API_KEY')) {
      return res.status(500).json({
        success: false,
        message: 'Email OTP is not configured. Set RESEND_API_KEY in .env.'
      });
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/email-otp/verify
router.post('/patient/email-otp/verify', async (req, res) => {
  try {
    const { uhid, otp } = req.body;
    if (!uhid || !otp) {
      return res.status(400).json({ success: false, message: 'UHID and OTP are required' });
    }

    const verification = emailOtp.verifyEmailOtp({ uhid, otp });
    if (!verification.ok) {
      return res.status(verification.status || 400).json({ success: false, message: verification.message });
    }

    const patient = await getPatientSessionPayload(uhid);
    if (!patient) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }

    return res.json({
      success: true,
      message: 'Email OTP verified successfully',
      patient
    });
  } catch (error) {
    console.error('Email OTP verify exception:', {
      message: error.message,
      code: error.code || null,
      stack: error.stack
    });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /doctor/login
router.post('/doctor/login', async (req, res) => {
  try {
    const { doctor_id, password } = req.body;

    if (!doctor_id || !password) {
      return res.status(400).json({ success: false, message: 'Doctor ID and password required' });
    }

    const doctor = await getDoctorByIdAndPassword(doctor_id, password);
    if (doctor) {
      res.json({ success: true, message: 'Doctor login successful', doctor_id: doctor_id });
    } else {
      res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Doctor login exception:', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /appointments/:doctorId
router.get('/appointments/:doctorId', async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    const doctor = await getDoctorById(doctorId);
    if (!doctor) {
      return res.status(400).json({ success: false, message: 'Invalid doctor' });
    }

    db.all(`
      SELECT a.*, p.full_name, p.uhid 
      FROM appointments a 
      JOIN patients p ON a.patient_uhid = p.uhid 
      WHERE a.doctor_id = ? 
      ORDER BY a.appointment_date DESC
    `, [doctorId], (err, rows) => {
      if (err) {
        console.error('Appointments fetch error:', err);
        return res.status(500).json({ success: false, message: 'Error fetching appointments' });
      }
      res.json({ success: true, appointments: rows || [] });
    });
  } catch (error) {
    console.error('Appointments exception:', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/access (Generate OTP for doctor access)
router.post('/patient/access', async (req, res) => {
  try {
    const { uhid, doctor_id } = req.body;

    if (!uhid || !doctor_id) {
      return res.status(400).json({ success: false, message: 'UHID and Doctor ID required' });
    }

    const doctor = await getDoctorById(doctor_id);
    if (!doctor) {
      return res.status(400).json({ success: false, message: 'Invalid doctor' });
    }

    await ensurePgPatientsTable();
    const result = await pgPool.query(
      'SELECT uhid, full_name, email FROM patients WHERE uhid = $1',
      [uhid]
    );
    const patient = result.rows[0];
    if (!patient) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }

    const sendResult = await emailOtp.sendDoctorAccessOtp({
      doctorId: doctor_id,
      uhid: patient.uhid,
      email: patient.email,
      name: patient.full_name
    });

    if (!sendResult.ok) {
      return res.status(sendResult.status || 400).json({ success: false, message: sendResult.message });
    }

    res.json({
      success: true,
      message: "OTP sent to patient's registered email.",
      expiresInMinutes: 5
    });
  } catch (error) {
    console.error('Patient access exception:', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/access/verify (Verify patient consent OTP for doctor access)
router.post('/patient/access/verify', async (req, res) => {
  try {
    const { uhid, doctor_id, otp } = req.body;

    if (!uhid || !doctor_id || !otp) {
      return res.status(400).json({ success: false, message: 'UHID, Doctor ID, and OTP required' });
    }

    const doctor = await getDoctorById(doctor_id);
    if (!doctor) {
      return res.status(400).json({ success: false, message: 'Invalid doctor' });
    }

    await ensurePgPatientsTable();
    const existsResult = await pgPool.query('SELECT uhid FROM patients WHERE uhid = $1', [uhid]);
    const existingPatient = existsResult.rows[0];
    if (!existingPatient) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }

    const verification = emailOtp.verifyDoctorAccessOtp({
      doctorId: doctor_id,
      uhid,
      otp
    });

    if (!verification.ok) {
      return res.status(verification.status || 400).json({ success: false, message: verification.message });
    }

    res.json({
      success: true,
      message: 'OTP verified. Doctor access granted for 15 minutes.',
      accessExpiresAt: verification.expiresAt
    });
  } catch (error) {
    console.error('Patient access verify exception:', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/update (Doctor updates patient record)
router.post('/patient/update', async (req, res) => {
  try {
    const { uhid, doctor_id, prescriptions, reports, medical_history, past_illness } = req.body;

    if (!uhid || !doctor_id) {
      return res.status(400).json({ success: false, message: 'UHID and Doctor ID required' });
    }

    const access = await ensureDoctorCanAccessPatient(res, doctor_id, uhid);
    if (!access) {
      return;
    }

    await ensurePgPatientsTable();
    const existsResult = await pgPool.query('SELECT uhid FROM patients WHERE uhid = $1', [uhid]);
    const existingPatient = existsResult.rows[0];
    if (!existingPatient) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }

    if (prescriptions !== undefined) {
      await upsertMedicalField('prescriptions', 'prescriptions', uhid, prescriptions);
    }
    if (reports !== undefined) {
      await upsertMedicalField('reports', 'reports', uhid, reports);
    }
    if (medical_history !== undefined) {
      await upsertMedicalField('medical_records', 'medical_history', uhid, medical_history);
    }
    if (past_illness !== undefined) {
      await upsertMedicalField('illness_history', 'past_illness', uhid, past_illness);
    }

    if (
      prescriptions === undefined &&
      reports === undefined &&
      medical_history === undefined &&
      past_illness === undefined
    ) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    res.json({
      success: true,
      message: 'Patient record updated successfully',
      accessExpiresAt: access.expiresAt
    });
  } catch (error) {
    console.error('Patient update exception:', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /patient/data/:uhid (Get patient data for view only)
router.get('/patient/data/:uhid', async (req, res) => {
  try {
    const uhid = req.params.uhid;
    const doctorId = req.query.doctor_id;
    const access = await ensureDoctorCanAccessPatient(res, doctorId, uhid);
    if (!access) {
      return;
    }

    await ensurePgPatientsTable();

    const result = await pgPool.query('SELECT * FROM patients WHERE uhid = $1', [uhid]);
    const patient = result.rows[0];
    if (!patient) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }
    const medicalSnapshot = await getPatientMedicalSnapshot(uhid);
    res.json({
      success: true,
      patient: { ...patient, ...medicalSnapshot },
      accessExpiresAt: access.expiresAt
    });
  } catch (error) {
    console.error('Patient data exception:', {
      message: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /patient/profile/:uhid
router.get('/patient/profile/:uhid', async (req, res) => {
  try {
    const uhid = req.params.uhid;
    await ensurePgPatientsTable();
    const result = await pgPool.query(
      'SELECT full_name, uhid, aadhaar_number, photo_url, created_at FROM patients WHERE uhid = $1',
      [uhid]
    );
    const patient = result.rows[0];
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const aadhaarLast4 = patient.aadhaar_number && patient.aadhaar_number.length >= 4
      ? patient.aadhaar_number.slice(-4)
      : null;

    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(
        JSON.stringify({
          uhid: patient.uhid,
          name: patient.full_name
        }),
        {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 180
        }
      );
    } catch (qrError) {
      console.error('Patient QR generation failed:', {
        message: qrError.message,
        code: qrError.code || null
      });
    }

    return res.json({
      success: true,
      profile: {
        name: patient.full_name,
        uhid: patient.uhid,
        aadhaar_last_4: aadhaarLast4,
        photo_url: patient.photo_url || null,
        qr_data_url: qrDataUrl,
        registration_date: patient.created_at || null
      }
    });
  } catch (error) {
    console.error('Patient profile exception:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /test-db (PostgreSQL test route)
router.get('/test-db', async (req, res) => {
  if (!pgPool) {
    return res.status(503).json({ success: false, message: 'Postgres not configured' });
  }

  try {
    const result = await pgPool.query('SELECT NOW()');
    res.json({ success: true, now: result.rows[0].now });
  } catch (error) {
    console.error('Postgres test query error:', error);
    res.status(500).json({
      success: false,
      message: 'Postgres query failed',
      error: error.message,
      code: error.code || null,
      detail: error.detail || null,
      hint: error.hint || null
    });
  }
});

// GET /patient/appointments/:uhid (Get patient's appointments)
router.get('/patient/appointments/:uhid', (req, res) => {
  try {
    const uhid = req.params.uhid;

    db.all(`
      SELECT a.*, 
      CASE 
        WHEN a.doctor_id = 'doctor1' THEN 'Dr. Smith'
        WHEN a.doctor_id = 'doctor2' THEN 'Dr. Johnson'
        WHEN a.doctor_id = 'doctor3' THEN 'Dr. Williams'
        ELSE a.doctor_id
      END as doctor_name
      FROM appointments a 
      WHERE a.patient_uhid = ? 
      ORDER BY a.appointment_date DESC
    `, [uhid], (err, rows) => {
      if (err) {
        console.error('Patient appointments fetch error:', err);
        return res.status(500).json({ success: false, message: 'Error fetching appointments' });
      }
      res.json({ success: true, appointments: rows || [] });
    });
  } catch (error) {
    console.error('Patient appointments exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
