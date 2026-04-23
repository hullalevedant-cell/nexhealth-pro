const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../nexhealth.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create patients table
    db.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uhid TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password TEXT NOT NULL,
        otp TEXT,
        age INTEGER,
        gender TEXT,
        blood_group TEXT,
        past_illness TEXT,
        medical_history TEXT,
        prescriptions TEXT,
        reports TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating patients table:', err.message);
      else console.log('Patients table ready');
    });

    // Create appointments table
    db.run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_uhid TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        appointment_date TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'scheduled',
        FOREIGN KEY (patient_uhid) REFERENCES patients(uhid)
      )
    `, (err) => {
      if (err) console.error('Error creating appointments table:', err.message);
      else console.log('Appointments table ready');
    });
  });
}

// Helper function to get next UHID
function getNextUHID(callback) {
  db.get('SELECT COUNT(*) as count FROM patients', (err, row) => {
    if (err) {
      callback(err, null);
    } else {
      const nextNum = 1001 + (row.count || 0);
      callback(null, 'UHID' + nextNum);
    }
  });
}

module.exports = { db, getNextUHID };
