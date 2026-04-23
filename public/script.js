// Global state
let currentUser = null;
let currentDoctor = null;

// ============ Helper Functions ============
function showMessage(element, message, type) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${type}`;
  msgDiv.textContent = message;
  element.insertBefore(msgDiv, element.firstChild);
  setTimeout(() => msgDiv.remove(), 5000);
}

function saveToSessionStorage(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function getFromSessionStorage(key) {
  const item = sessionStorage.getItem(key);
  return item ? JSON.parse(item) : null;
}

function logout() {
  sessionStorage.clear();
  window.location.href = '/';
}

// ============ Patient Registration ============
const patientRegisterForm = document.getElementById('patientRegisterForm');
if (patientRegisterForm) {
  patientRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = patientRegisterForm.parentElement;

    const formData = {
      full_name: document.getElementById('fullName').value,
      password: document.getElementById('regPassword').value,
      age: parseInt(document.getElementById('age').value),
      gender: document.getElementById('gender').value,
      blood_group: document.getElementById('bloodGroup').value,
      past_illness: document.getElementById('pastIllness').value,
      medical_history: document.getElementById('medicalHistory').value
    };

    try {
      const response = await fetch('/patient/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        showMessage(container, `Registration successful! Your UHID: ${data.uhid}`, 'success');
        patientRegisterForm.reset();
        setTimeout(() => {
          window.location.href = '/patient-login.html';
        }, 2000);
      } else {
        showMessage(container, data.message, 'error');
      }
    } catch (error) {
      showMessage(container, 'Error during registration', 'error');
    }
  });
}

// ============ Patient Login ============
const patientLoginForm = document.getElementById('patientLoginForm');
if (patientLoginForm) {
  patientLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = patientLoginForm.parentElement;
    const useOTP = document.getElementById('useOTP').checked;

    const loginData = {
      uhid: document.getElementById('uhid').value,
      useOTP: useOTP,
      password: useOTP ? undefined : document.getElementById('password').value,
      otp: useOTP ? document.getElementById('otp').value : undefined
    };

    if (!useOTP && !loginData.password) {
      showMessage(container, 'Password required', 'error');
      return;
    }

    if (useOTP && !loginData.otp) {
      showMessage(container, 'OTP required', 'error');
      return;
    }

    try {
      const response = await fetch('/patient/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (data.success) {
        saveToSessionStorage('currentPatient', data.patient);
        showMessage(container, 'Login successful!', 'success');
        setTimeout(() => {
          window.location.href = '/patient-dashboard.html';
        }, 1500);
      } else {
        showMessage(container, data.message, 'error');
      }
    } catch (error) {
      showMessage(container, 'Login error', 'error');
    }
  });

  // Toggle OTP/Password input
  const useOTPCheckbox = document.getElementById('useOTP');
  if (useOTPCheckbox) {
    useOTPCheckbox.addEventListener('change', () => {
      const passwordGroup = document.getElementById('passwordGroup');
      const otpGroup = document.getElementById('otpGroup');
      if (useOTPCheckbox.checked) {
        passwordGroup.style.display = 'none';
        otpGroup.style.display = 'block';
        document.getElementById('otp').focus();
      } else {
        passwordGroup.style.display = 'block';
        otpGroup.style.display = 'none';
        document.getElementById('password').focus();
      }
    });
  }
}

// ============ Doctor Login ============
const doctorLoginForm = document.getElementById('doctorLoginForm');
if (doctorLoginForm) {
  doctorLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = doctorLoginForm.parentElement;

    const loginData = {
      doctor_id: document.getElementById('doctorId').value,
      password: document.getElementById('doctorPassword').value
    };

    try {
      const response = await fetch('/doctor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (data.success) {
        saveToSessionStorage('currentDoctor', { doctor_id: data.doctor_id });
        showMessage(container, 'Login successful!', 'success');
        setTimeout(() => {
          window.location.href = '/doctor-dashboard.html';
        }, 1500);
      } else {
        showMessage(container, data.message, 'error');
      }
    } catch (error) {
      showMessage(container, 'Login error', 'error');
    }
  });
}

// ============ Patient Dashboard ============
const patientDashboard = document.getElementById('patientDashboard');
if (patientDashboard) {
  // Check if patient is logged in
  const patient = getFromSessionStorage('currentPatient');
  if (!patient) {
    window.location.href = '/patient-login.html';
  } else {
    // Display patient info
    document.getElementById('patientUHID').textContent = patient.uhid;
    document.getElementById('patientName').textContent = patient.full_name;
    document.getElementById('patientAge').textContent = patient.age;
    document.getElementById('patientGender').textContent = patient.gender;
    document.getElementById('patientBlood').textContent = patient.blood_group;
    document.getElementById('patientPastIllness').textContent = patient.past_illness || 'None';
    document.getElementById('patientMedicalHistory').textContent = patient.medical_history || 'None';
    document.getElementById('patientPrescriptions').textContent = patient.prescriptions || 'No prescriptions';
    document.getElementById('patientReports').textContent = patient.reports || 'No reports';

    // Load appointments
    loadPatientAppointments(patient.uhid);

    // Setup logout
    const logoutBtn = document.getElementById('patientLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  }
}

async function loadPatientAppointments(uhid) {
  try {
    const response = await fetch(`/patient/appointments/${uhid}`);
    const data = await response.json();

    if (data.success && data.appointments.length > 0) {
      const appointmentsTable = document.getElementById('patientAppointmentsTable');
      if (appointmentsTable) {
        appointmentsTable.innerHTML = '';
        data.appointments.forEach(apt => {
          appointmentsTable.innerHTML += `
            <tr>
              <td>${apt.doctor_name || apt.doctor_id}</td>
              <td>${new Date(apt.appointment_date).toLocaleString()}</td>
              <td><span style="padding: 4px 8px; background: #d4edda; border-radius: 4px; color: #155724;">${apt.status}</span></td>
            </tr>
          `;
        });
      }
    } else {
      const appointmentsTable = document.getElementById('patientAppointmentsTable');
      if (appointmentsTable) {
        appointmentsTable.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No appointments scheduled</td></tr>';
      }
    }
  } catch (error) {
    console.error('Error loading appointments:', error);
  }
}

// ============ Doctor Dashboard ============
const doctorDashboard = document.getElementById('doctorDashboard');
if (doctorDashboard) {
  // Check if doctor is logged in
  const doctor = getFromSessionStorage('currentDoctor');
  if (!doctor) {
    window.location.href = '/doctor-login.html';
  } else {
    document.getElementById('doctorIdDisplay').textContent = doctor.doctor_id;
    loadDoctorAppointments(doctor.doctor_id);

    // Setup search patient form
    const searchPatientForm = document.getElementById('searchPatientForm');
    if (searchPatientForm) {
      searchPatientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const container = searchPatientForm.parentElement;
        const uhid = document.getElementById('searchUHID').value;

        try {
          const response = await fetch('/patient/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uhid, doctor_id: doctor.doctor_id })
          });

          const data = await response.json();

          if (data.success) {
            // Store for later verification
            saveToSessionStorage('pendingPatientUHID', uhid);
            saveToSessionStorage('pendingOTP', data.otp); // For demo purposes
            showMessage(container, `OTP generated: ${data.otp} (Demo mode)`, 'info');

            // Show OTP verification modal
            document.getElementById('otpVerifyModal').classList.add('show');
            document.getElementById('verifyOtpInput').value = '';
            document.getElementById('verifyOtpInput').focus();
          } else {
            showMessage(container, data.message, 'error');
          }
        } catch (error) {
          showMessage(container, 'Error searching patient', 'error');
        }
      });
    }

    // Setup OTP verification
    const verifyOtpForm = document.getElementById('verifyOtpForm');
    if (verifyOtpForm) {
      verifyOtpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const container = verifyOtpForm.parentElement;
        const otp = document.getElementById('verifyOtpInput').value;
        const correctOTP = getFromSessionStorage('pendingOTP');

        if (otp === correctOTP) {
          showMessage(container, 'OTP verified successfully!', 'success');
          document.getElementById('otpVerifyModal').classList.remove('show');

          const uhid = getFromSessionStorage('pendingPatientUHID');
          loadPatientForDoctor(uhid, doctor.doctor_id);

          document.getElementById('searchUHID').value = '';
        } else {
          showMessage(container, 'Invalid OTP', 'error');
        }
      });
    }

    // Close modal
    const closeBtn = document.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('otpVerifyModal').classList.remove('show');
      });
    }

    // Setup logout
    const logoutBtn = document.getElementById('doctorLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  }
}

async function loadDoctorAppointments(doctorId) {
  try {
    const response = await fetch(`/appointments/${doctorId}`);
    const data = await response.json();

    if (data.success && data.appointments.length > 0) {
      const appointmentsTable = document.getElementById('doctorAppointmentsTable');
      if (appointmentsTable) {
        appointmentsTable.innerHTML = '';
        data.appointments.forEach(apt => {
          appointmentsTable.innerHTML += `
            <tr>
              <td>${apt.full_name}</td>
              <td>${apt.uhid}</td>
              <td>${new Date(apt.appointment_date).toLocaleString()}</td>
              <td><span style="padding: 4px 8px; background: #d4edda; border-radius: 4px; color: #155724;">${apt.status}</span></td>
            </tr>
          `;
        });
      }
    }
  } catch (error) {
    console.error('Error loading appointments:', error);
  }
}

async function loadPatientForDoctor(uhid, doctorId) {
  try {
    const response = await fetch(`/patient/data/${uhid}`);
    const data = await response.json();

    if (data.success) {
      const patient = data.patient;
      saveToSessionStorage('accessedPatient', patient);

      // Display patient info
      document.getElementById('accessedPatientUHID').textContent = patient.uhid;
      document.getElementById('accessedPatientName').textContent = patient.full_name;
      document.getElementById('accessedPatientAge').textContent = patient.age;
      document.getElementById('accessedPatientGender').textContent = patient.gender;
      document.getElementById('accessedPatientBlood').textContent = patient.blood_group;

      // Display editable fields
      document.getElementById('editPastIllness').value = patient.past_illness || '';
      document.getElementById('editMedicalHistory').value = patient.medical_history || '';
      document.getElementById('editPrescriptions').value = patient.prescriptions || '';
      document.getElementById('editReports').value = patient.reports || '';

      // Show edit section
      document.getElementById('patientViewSection').style.display = 'block';
      document.getElementById('patientEditSection').style.display = 'block';

      // Setup update form
      const updatePatientForm = document.getElementById('updatePatientForm');
      if (updatePatientForm) {
        updatePatientForm.onsubmit = async (e) => {
          e.preventDefault();
          const container = updatePatientForm.parentElement;
          const otp = getFromSessionStorage('pendingOTP');

          const updateData = {
            uhid: uhid,
            doctor_id: doctorId,
            otp: otp,
            past_illness: document.getElementById('editPastIllness').value,
            medical_history: document.getElementById('editMedicalHistory').value,
            prescriptions: document.getElementById('editPrescriptions').value,
            reports: document.getElementById('editReports').value
          };

          try {
            const response = await fetch('/patient/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (result.success) {
              showMessage(container, 'Patient record updated successfully', 'success');
            } else {
              showMessage(container, result.message, 'error');
            }
          } catch (error) {
            showMessage(container, 'Error updating patient', 'error');
          }
        };
      }
    }
  } catch (error) {
    console.error('Error loading patient:', error);
  }
}

// ============ Tab Navigation ============
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    
    // Remove active class from all buttons and contents
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    button.classList.add('active');
    const content = document.getElementById(tabName);
    if (content) {
      content.classList.add('active');
    }
  });
});

// ============ OTP Visibility Toggle ============
const toggleOtpBtn = document.getElementById('toggleOtpVisibility');
if (toggleOtpBtn) {
  toggleOtpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const otpInput = document.getElementById('verifyOtpInput');
    if (otpInput.type === 'password') {
      otpInput.type = 'text';
      toggleOtpBtn.textContent = 'Hide';
    } else {
      otpInput.type = 'password';
      toggleOtpBtn.textContent = 'Show';
    }
  });
}
