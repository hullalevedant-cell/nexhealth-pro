// In-memory OTP storage
const otpStore = {};

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP for a patient
function setOTP(uhid, otp) {
  otpStore[uhid] = {
    otp: otp,
    timestamp: Date.now(),
    attempts: 0
  };
}

// Verify OTP
function verifyOTP(uhid, inputOTP) {
  if (!otpStore[uhid]) {
    return { valid: false, message: 'OTP not found' };
  }

  const stored = otpStore[uhid];
  
  // Check if OTP expired (5 minutes)
  if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
    delete otpStore[uhid];
    return { valid: false, message: 'OTP expired' };
  }

  // Check attempts
  if (stored.attempts >= 3) {
    delete otpStore[uhid];
    return { valid: false, message: 'Too many attempts' };
  }

  if (stored.otp === inputOTP) {
    delete otpStore[uhid];
    return { valid: true, message: 'OTP verified' };
  }

  stored.attempts++;
  return { valid: false, message: 'Invalid OTP' };
}

// Generate and store OTP, return the OTP
function generateAndStoreOTP(uhid) {
  const otp = generateOTP();
  setOTP(uhid, otp);
  return otp;
}

module.exports = {
  generateOTP,
  setOTP,
  verifyOTP,
  generateAndStoreOTP
};
