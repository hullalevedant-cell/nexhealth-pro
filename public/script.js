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

function setMessageHtml(element, message, type) {
  if (!element) return;
  element.innerHTML = `<div class="message ${type}">${message}</div>`;
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

function getFallbackProfileImage() {
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%23f5f5f5"/><circle cx="60" cy="45" r="22" fill="%23c9d6e5"/><rect x="28" y="76" width="64" height="30" rx="15" fill="%23c9d6e5"/></svg>';
}

// ============ Copy to Clipboard Function ============
function copyToClipboard(text, buttonElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '✓ Copied!';
    buttonElement.style.backgroundColor = '#4CAF50';
    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.style.backgroundColor = '';
    }, 2000);
  }).catch(() => {
    alert('Failed to copy. Please copy manually: ' + text);
  });
}

// ============ Patient Registration ============
const patientRegisterForm = document.getElementById('patientRegisterForm');
if (patientRegisterForm) {
  patientRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = patientRegisterForm.parentElement;
    const aadhaarNumber = document.getElementById('aadhaarNumber').value.trim();
    const patientPhotoInput = document.getElementById('patientPhoto');
    const patientPhotoFile = patientPhotoInput.files && patientPhotoInput.files[0];
    const email = document.getElementById('email').value.trim();

    if (!email) {
      showMessage(container, 'Email address is required', 'error');
      return;
    }

    if (!/^\d{12}$/.test(aadhaarNumber)) {
      showMessage(container, 'Aadhaar number must be exactly 12 digits', 'error');
      return;
    }

    if (!patientPhotoFile) {
      showMessage(container, 'Patient photo is required', 'error');
      return;
    }

    const validImageTypes = ['image/jpeg', 'image/png'];
    if (!validImageTypes.includes(patientPhotoFile.type)) {
      showMessage(container, 'Only JPG, JPEG, and PNG files are allowed', 'error');
      return;
    }
    if (patientPhotoFile.size > 5 * 1024 * 1024) {
      showMessage(container, 'Photo must be 5MB or smaller', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('full_name', document.getElementById('fullName').value);
    formData.append('password', document.getElementById('regPassword').value);
    formData.append('age', parseInt(document.getElementById('age').value, 10));
    formData.append('gender', document.getElementById('gender').value);
    formData.append('blood_group', document.getElementById('bloodGroup').value);
    formData.append('email', email);
    formData.append('aadhaar_number', aadhaarNumber);
    formData.append('past_illness', document.getElementById('pastIllness').value);
    formData.append('medical_history', document.getElementById('medicalHistory').value);
    formData.append('photo', patientPhotoFile);

    try {
      const response = await fetch('/patient/register', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        const successContainer = document.getElementById('registrationSuccess');
        if (successContainer) {
          successContainer.innerHTML = '';
          const successBox = document.createElement('div');
          successBox.className = 'message success';

          const contentRow = document.createElement('div');
          contentRow.style.display = 'flex';
          contentRow.style.justifyContent = 'space-between';
          contentRow.style.alignItems = 'center';
          contentRow.style.gap = '15px';
          contentRow.style.flexWrap = 'wrap';

          const textBlock = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = '✓ Registration successful!';
          textBlock.appendChild(title);

          const uhidText = document.createElement('p');
          uhidText.style.marginTop = '8px';
          uhidText.style.fontSize = '14px';
          uhidText.innerHTML = `Your UHID: <strong style="color: #0066cc;">${data.uhid}</strong>`;
          textBlock.appendChild(uhidText);

          const buttonBlock = document.createElement('div');
          buttonBlock.style.display = 'flex';
          buttonBlock.style.gap = '10px';
          buttonBlock.style.flexWrap = 'wrap';

          const copyButton = document.createElement('button');
          copyButton.type = 'button';
          copyButton.className = 'btn-copy-uhid';
          copyButton.textContent = '📋 Copy UHID';
          copyButton.addEventListener('click', () => copyToClipboard(data.uhid, copyButton));
          buttonBlock.appendChild(copyButton);

          const loginButton = document.createElement('button');
          loginButton.type = 'button';
          loginButton.className = 'btn btn-secondary btn-small';
          loginButton.textContent = 'Go to Login';
          loginButton.addEventListener('click', () => {
            window.location.href = '/patient-login.html';
          });
          buttonBlock.appendChild(loginButton);

          contentRow.appendChild(textBlock);
          contentRow.appendChild(buttonBlock);
          successBox.appendChild(contentRow);
          successContainer.appendChild(successBox);
        }
        patientRegisterForm.reset();
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
    const loginData = {
      uhid: document.getElementById('uhid').value,
      password: document.getElementById('password').value
    };

    if (!loginData.password) {
      showMessage(container, 'Password required', 'error');
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

  const sendEmailOtpBtn = document.getElementById('sendEmailOtpBtn');
  if (sendEmailOtpBtn) {
    sendEmailOtpBtn.addEventListener('click', async () => {
      const container = patientLoginForm.parentElement;
      const uhid = document.getElementById('uhid').value.trim();

      if (!uhid) {
        showMessage(container, 'UHID is required to send an email OTP', 'error');
        return;
      }

      sendEmailOtpBtn.disabled = true;
      const originalText = sendEmailOtpBtn.textContent;
      sendEmailOtpBtn.textContent = 'Sending...';

      try {
        const response = await fetch('/patient/email-otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uhid })
        });
        const data = await response.json();

        if (data.success) {
          saveToSessionStorage('pendingEmailOtpUhid', uhid);
          showMessage(container, data.message || 'OTP sent successfully', 'success');
          setTimeout(() => {
            window.location.href = `/patient-email-otp.html?uhid=${encodeURIComponent(uhid)}`;
          }, 800);
        } else {
          showMessage(container, data.message || 'Failed to send OTP', 'error');
        }
      } catch (error) {
        showMessage(container, 'Error sending OTP', 'error');
      } finally {
        sendEmailOtpBtn.disabled = false;
        sendEmailOtpBtn.textContent = originalText;
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
    const viewUHIDCardBtn = document.getElementById('viewUHIDCardBtn');
    if (viewUHIDCardBtn && patient.uhid) {
      viewUHIDCardBtn.href = `/uhid-card.html?uhid=${encodeURIComponent(patient.uhid)}`;
    }

    loadPatientProfile(patient.uhid);

    // Load appointments
    loadPatientAppointments(patient.uhid);

    // Setup logout
    const logoutBtn = document.getElementById('patientLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  }
}

async function loadPatientProfile(uhid) {
  const profilePhotoEl = document.getElementById('patientProfilePhoto');
  const aadhaarLast4El = document.getElementById('patientAadhaarLast4');
  const fallbackPhoto = getFallbackProfileImage();

  if (profilePhotoEl) {
    profilePhotoEl.src = fallbackPhoto;
    profilePhotoEl.onerror = () => {
      profilePhotoEl.src = fallbackPhoto;
    };
  }

  try {
    const response = await fetch(`/patient/profile/${uhid}`);
    const data = await response.json();
    if (!data.success || !data.profile) {
      return;
    }

    const profile = data.profile;
    if (profile.name) {
      document.getElementById('patientName').textContent = profile.name;
    }
    if (profile.uhid) {
      document.getElementById('patientUHID').textContent = profile.uhid;
    }
    if (aadhaarLast4El) {
      aadhaarLast4El.textContent = profile.aadhaar_last_4 || '----';
    }
    if (profilePhotoEl && profile.photo_url) {
      profilePhotoEl.src = profile.photo_url;
    }
  } catch (error) {
    console.error('Error loading patient profile:', error);
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

// ============ Patient Email OTP Page ============
const patientEmailOtpForm = document.getElementById('patientEmailOtpForm');
if (patientEmailOtpForm) {
  const uhidInput = document.getElementById('emailOtpUhid');
  const otpInput = document.getElementById('emailOtp');
  const resendBtn = document.getElementById('resendEmailOtpBtn');
  const queryUhid = new URLSearchParams(window.location.search).get('uhid');
  const storedUhid = getFromSessionStorage('pendingEmailOtpUhid');
  const resolvedUhid = queryUhid || storedUhid || '';

  if (resolvedUhid && uhidInput) {
    uhidInput.value = resolvedUhid;
  }

  patientEmailOtpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = patientEmailOtpForm.parentElement;
    const uhid = uhidInput.value.trim();
    const otp = otpInput.value.trim();

    if (!uhid || !otp) {
      showMessage(container, 'UHID and OTP are required', 'error');
      return;
    }

    try {
      const response = await fetch('/patient/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uhid, otp })
      });
      const data = await response.json();

      if (data.success) {
        saveToSessionStorage('currentPatient', data.patient);
        sessionStorage.removeItem('pendingEmailOtpUhid');
        showMessage(container, 'OTP verified successfully!', 'success');
        setTimeout(() => {
          window.location.href = '/patient-dashboard.html';
        }, 1200);
      } else {
        showMessage(container, data.message || 'OTP verification failed', 'error');
      }
    } catch (error) {
      showMessage(container, 'Error verifying OTP', 'error');
    }
  });

  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      const container = patientEmailOtpForm.parentElement;
      const uhid = uhidInput.value.trim();

      if (!uhid) {
        showMessage(container, 'UHID is required to resend OTP', 'error');
        return;
      }

      resendBtn.disabled = true;
      const originalText = resendBtn.textContent;
      resendBtn.textContent = 'Resending...';

      try {
        const response = await fetch('/patient/email-otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uhid })
        });
        const data = await response.json();

        if (data.success) {
          saveToSessionStorage('pendingEmailOtpUhid', uhid);
          showMessage(container, data.message || 'OTP resent successfully', 'success');
        } else {
          showMessage(container, data.message || 'Failed to resend OTP', 'error');
        }
      } catch (error) {
        showMessage(container, 'Error resending OTP', 'error');
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = originalText;
      }
    });
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

// ============ UHID Card Page ============
const uhidCardPage = document.getElementById('uhidCardPage');
if (uhidCardPage) {
  const patient = getFromSessionStorage('currentPatient');
  const queryUhid = new URLSearchParams(window.location.search).get('uhid');
  const resolvedUhid = queryUhid || (patient && patient.uhid);
  if (!resolvedUhid) {
    window.location.href = '/patient-login.html';
  } else {
    loadUHIDCard(resolvedUhid);
  }
}

async function loadUHIDCard(uhid) {
  const messageEl = document.getElementById('uhidCardMessage');
  const cardPhotoEl = document.getElementById('uhidCardPhoto');
  const cardNameEl = document.getElementById('uhidCardName');
  const cardUHIDEl = document.getElementById('uhidCardUHID');
  const cardAadhaarEl = document.getElementById('uhidCardAadhaarLast4');
  const cardRegistrationDateEl = document.getElementById('uhidCardRegistrationDate');
  const cardQrEl = document.getElementById('uhidCardQr');
  const downloadBtn = document.getElementById('downloadUHIDCardBtn');
  const fallbackPhoto = getFallbackProfileImage();
  const fallbackQr = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92"><rect width="100%" height="100%" fill="%23ffffff"/><rect x="8" y="8" width="76" height="76" rx="8" fill="%23f5f5f5" stroke="%23d0d7de"/><path d="M24 24h14v14H24zM54 24h14v14H54zM24 54h14v14H24z" fill="%23c9d6e5"/></svg>';

  cardPhotoEl.src = fallbackPhoto;
  cardPhotoEl.onerror = () => {
    cardPhotoEl.src = fallbackPhoto;
  };
  if (cardQrEl) {
    cardQrEl.src = fallbackQr;
    cardQrEl.onerror = () => {
      cardQrEl.src = fallbackQr;
    };
  }
  cardRegistrationDateEl.textContent = 'Not Available';
  if (messageEl) {
    messageEl.innerHTML = '';
  }

  try {
    const response = await fetch(`/patient/profile/${uhid}`);
    const data = await response.json();

    if (!data.success || !data.profile) {
      setMessageHtml(messageEl, 'Unable to load UHID card profile data.', 'error');
      if (downloadBtn) downloadBtn.disabled = true;
      return;
    }

    const profile = data.profile;
    cardNameEl.textContent = profile.name || 'Not Available';
    cardUHIDEl.textContent = profile.uhid || uhid;
    cardAadhaarEl.textContent = profile.aadhaar_last_4 ? profile.aadhaar_last_4 : 'Missing';
    cardRegistrationDateEl.textContent = profile.registration_date
      ? new Date(profile.registration_date).toLocaleDateString()
      : 'Not Available';

    const warnings = [];
    if (profile.photo_url) {
      cardPhotoEl.src = profile.photo_url;
    } else {
      warnings.push({ text: 'Photo not found. Card will use a placeholder image.', type: 'info' });
    }

    if (!profile.aadhaar_last_4) {
      warnings.push({ text: 'Aadhaar information missing. Only available data is shown.', type: 'warning' });
    }

    if (profile.qr_data_url) {
      if (cardQrEl) {
        cardQrEl.src = profile.qr_data_url;
      }
    } else {
      warnings.push({ text: 'QR code could not be generated for this patient.', type: 'error' });
      if (downloadBtn) downloadBtn.disabled = true;
    }

    if (warnings.length > 0 && messageEl) {
      messageEl.innerHTML = warnings
        .map((warning) => `<div class="message ${warning.type}">${warning.text}</div>`)
        .join('');
    }

    if (downloadBtn) {
      downloadBtn.onclick = downloadUHIDCardPdf;
    }
  } catch (error) {
    console.error('Error loading UHID card:', error);
    setMessageHtml(messageEl, 'Error loading card data. Please try again.', 'error');
    if (downloadBtn) downloadBtn.disabled = true;
  }
}

async function downloadUHIDCardPdf() {
  const messageEl = document.getElementById('uhidCardMessage');
  const cardCanvasEl = document.getElementById('uhidCardCanvas');
  const cardUHIDEl = document.getElementById('uhidCardUHID');
  const renderedUHID = (cardUHIDEl && cardUHIDEl.textContent || '').trim();

  if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
    setMessageHtml(messageEl, 'PDF library failed to load. Check internet connectivity and retry.', 'error');
    return;
  }
  if (!cardCanvasEl || !renderedUHID || renderedUHID === '-') {
    setMessageHtml(messageEl, 'Unable to download card. Missing UHID card data.', 'error');
    return;
  }

  try {
    const canvas = await window.html2canvas(cardCanvasEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imageData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape', 'pt', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min((pageWidth - 40) / imgWidth, (pageHeight - 40) / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;
    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    pdf.addImage(imageData, 'PNG', x, y, renderWidth, renderHeight);
    pdf.save(`${renderedUHID}-UHID-Card.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    setMessageHtml(messageEl, 'Failed to generate UHID card PDF. Please retry.', 'error');
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
