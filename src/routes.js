const express = require('express');
const router = express.Router();
const { db, getNextUHID } = require('./db');
const otpModule = require('./otp');

// Hardcoded doctors
const doctors = {
  'doctor1': 'pass123',
  'doctor2': 'pass123',
  'doctor3': 'pass123'
};

// POST /patient/register
router.post('/patient/register', (req, res) => {
  try {
    const { full_name, password, age, gender, blood_group, past_illness, medical_history } = req.body;

    if (!full_name || !password || !age || !gender || !blood_group) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    getNextUHID((err, uhid) => {
      if (err) {
        console.error('UHID generation error:', err);
        return res.status(500).json({ success: false, message: 'Error generating UHID' });
      }

      const query = `
        INSERT INTO patients (uhid, full_name, password, age, gender, blood_group, past_illness, medical_history, prescriptions, reports)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '')
      `;

      db.run(query, [uhid, full_name, password, age, gender, blood_group, past_illness || '', medical_history || ''], (err) => {
        if (err) {
          console.error('Registration error:', err);
          return res.status(500).json({ success: false, message: 'Registration error' });
        }
        res.json({ success: true, message: 'Patient registered successfully', uhid: uhid });
      });
    });
  } catch (error) {
    console.error('Registration exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/login
router.post('/patient/login', (req, res) => {
  try {
    const { uhid, password, useOTP, otp } = req.body;

    if (!uhid) {
      return res.status(400).json({ success: false, message: 'UHID is required' });
    }

    // Check if using OTP or password
    if (useOTP && otp) {
      const otpVerification = otpModule.verifyOTP(uhid, otp);
      if (!otpVerification.valid) {
        return res.status(400).json({ success: false, message: otpVerification.message });
      }
      // OTP verified, proceed with login
      db.get('SELECT * FROM patients WHERE uhid = ?', [uhid], (err, row) => {
        if (err) {
          console.error('Patient lookup error:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!row) {
          return res.status(400).json({ success: false, message: 'Patient not found' });
        }
        res.json({ success: true, message: 'Login successful via OTP', patient: row });
      });
    } else if (password) {
      db.get('SELECT * FROM patients WHERE uhid = ? AND password = ?', [uhid, password], (err, row) => {
        if (err) {
          console.error('Patient login error:', err);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        if (!row) {
          return res.status(400).json({ success: false, message: 'Invalid UHID or password' });
        }
        res.json({ success: true, message: 'Login successful', patient: row });
      });
    } else {
      return res.status(400).json({ success: false, message: 'Password or OTP required' });
    }
  } catch (error) {
    console.error('Login exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /doctor/login
router.post('/doctor/login', (req, res) => {
  try {
    const { doctor_id, password } = req.body;

    if (!doctor_id || !password) {
      return res.status(400).json({ success: false, message: 'Doctor ID and password required' });
    }

    if (doctors[doctor_id] && doctors[doctor_id] === password) {
      res.json({ success: true, message: 'Doctor login successful', doctor_id: doctor_id });
    } else {
      res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Doctor login exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /appointments/:doctorId
router.get('/appointments/:doctorId', (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    if (!doctors[doctorId]) {
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
    console.error('Appointments exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/access (Generate OTP for doctor access)
router.post('/patient/access', (req, res) => {
  try {
    const { uhid, doctor_id } = req.body;

    if (!uhid || !doctor_id) {
      return res.status(400).json({ success: false, message: 'UHID and Doctor ID required' });
    }

    if (!doctors[doctor_id]) {
      return res.status(400).json({ success: false, message: 'Invalid doctor' });
    }

    db.get('SELECT * FROM patients WHERE uhid = ?', [uhid], (err, row) => {
      if (err) {
        console.error('Patient access error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!row) {
        return res.status(400).json({ success: false, message: 'Patient not found' });
      }

      // Generate OTP
      const otp = otpModule.generateAndStoreOTP(uhid);
      
      res.json({ 
        success: true, 
        message: 'OTP generated and sent to patient',
        otp: otp
      });
    });
  } catch (error) {
    console.error('Patient access exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /patient/update (Doctor updates patient record)
router.post('/patient/update', (req, res) => {
  try {
    const { uhid, doctor_id, otp, prescriptions, reports, medical_history, past_illness } = req.body;

    if (!uhid || !doctor_id || !otp) {
      return res.status(400).json({ success: false, message: 'UHID, Doctor ID, and OTP required' });
    }

    if (!doctors[doctor_id]) {
      return res.status(400).json({ success: false, message: 'Invalid doctor' });
    }

    // Verify OTP
    const otpVerification = otpModule.verifyOTP(uhid, otp);
    if (!otpVerification.valid) {
      return res.status(400).json({ success: false, message: otpVerification.message });
    }

    db.get('SELECT * FROM patients WHERE uhid = ?', [uhid], (err, row) => {
      if (err) {
        console.error('Patient lookup error in update:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!row) {
        return res.status(400).json({ success: false, message: 'Patient not found' });
      }

      // Update patient record
      const updates = [];
      const values = [];

      if (prescriptions !== undefined) {
        updates.push('prescriptions = ?');
        values.push(prescriptions);
      }
      if (reports !== undefined) {
        updates.push('reports = ?');
        values.push(reports);
      }
      if (medical_history !== undefined) {
        updates.push('medical_history = ?');
        values.push(medical_history);
      }
      if (past_illness !== undefined) {
        updates.push('past_illness = ?');
        values.push(past_illness);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      values.push(uhid);

      db.run(`UPDATE patients SET ${updates.join(', ')} WHERE uhid = ?`, values, (err) => {
        if (err) {
          console.error('Patient update error:', err);
          return res.status(500).json({ success: false, message: 'Error updating patient' });
        }
        res.json({ success: true, message: 'Patient record updated successfully' });
      });
    });
  } catch (error) {
    console.error('Patient update exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /patient/data/:uhid (Get patient data for view only)
router.get('/patient/data/:uhid', (req, res) => {
  try {
    const uhid = req.params.uhid;

    db.get('SELECT * FROM patients WHERE uhid = ?', [uhid], (err, row) => {
      if (err) {
        console.error('Patient data fetch error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!row) {
        return res.status(400).json({ success: false, message: 'Patient not found' });
      }
      res.json({ success: true, patient: row });
    });
  } catch (error) {
    console.error('Patient data exception:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
