const crypto = require('crypto');
const https = require('https');

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const DOCTOR_ACCESS_EXPIRY_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const RESEND_API_HOST = 'api.resend.com';
const RESEND_API_PATH = '/emails';

const otpStore = new Map();
const doctorAccessOtpStore = new Map();
const doctorAccessGrantStore = new Map();

function normalizeKey(uhid) {
  return String(uhid || '').trim().toUpperCase();
}

function normalizeDoctorKey(doctorId) {
  return String(doctorId || '').trim().toLowerCase();
}

function buildDoctorAccessKey(doctorId, uhid) {
  return `${normalizeDoctorKey(doctorId)}::${normalizeKey(uhid)}`;
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = 'NexHealth <onboarding@resend.dev>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required');
  }

  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL or EMAIL_USER is required');
  }

  return { apiKey, fromEmail };
}

function sendOtpEmail({ to, otp, name }) {
  return dispatchOtpEmail({
    to,
    otp,
    name,
    subject: 'Your NexHealth Pro login OTP',
    introLine: 'Your login OTP is provided below.'
  });
}

function pruneRequests(record, now) {
  record.requests = record.requests.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
}

function cleanupExpired(record, now) {
  return !record || record.expiresAt <= now || record.used;
}

function maskEmail(email) {
  const value = String(email || '');
  const [local, domain] = value.split('@');
  if (!local || !domain) return 'registered email';
  const localMasked = local.length <= 2 ? `${local[0] || '*'}*` : `${local[0]}***${local.slice(-1)}`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const domainExt = domainParts.slice(1).join('.') || '';
  const domainMasked = domainName.length <= 2 ? `${domainName[0] || '*'}*` : `${domainName[0]}***${domainName.slice(-1)}`;
  return domainExt ? `${localMasked}@${domainMasked}.${domainExt}` : `${localMasked}@${domainMasked}`;
}

function buildOtpRecord(now, email, name, otp) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    requests: [now],
    email,
    name,
    otp: {
      hash: hashOtp(otp, salt),
      salt,
      expiresAt: now + OTP_EXPIRY_MS,
      used: false
    }
  };
}

function validateOtpRecord(record, inputOtp, key, store) {
  const now = Date.now();
  if (!record || !record.otp || cleanupExpired(record.otp, now)) {
    store.delete(key);
    return { ok: false, status: 400, message: 'OTP expired or not found. Please request a new one.' };
  }

  if (record.otp.used) {
    store.delete(key);
    return { ok: false, status: 400, message: 'OTP has already been used. Please request a new one.' };
  }

  if (record.otp.expiresAt < now) {
    store.delete(key);
    return { ok: false, status: 400, message: 'OTP expired. Please request a new one.' };
  }

  const inputHash = hashOtp(inputOtp, record.otp.salt);
  if (inputHash !== record.otp.hash) {
    return { ok: false, status: 400, message: 'Invalid OTP' };
  }

  return { ok: true };
}

async function dispatchOtpEmail({ to, otp, name, subject, introLine }) {
  const { apiKey, fromEmail } = getResendConfig();
  console.log('[Resend] Using sender address', {
    from: fromEmail
  });

  const payload = JSON.stringify({
    from: fromEmail,
    to: [to],
    subject,
    text: [
      `Hello ${name || 'Patient'},`,
      '',
      introLine,
      `Your OTP is: ${otp}`,
      'This OTP expires in 5 minutes and can only be used once.',
      '',
      'If you did not request this, please ignore this email.'
    ].join('\n')
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: RESEND_API_HOST,
        path: RESEND_API_PATH,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 30000
      },
      (response) => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });

        response.on('end', () => {
          let parsedBody = null;

          try {
            parsedBody = responseBody ? JSON.parse(responseBody) : null;
          } catch (error) {
            console.error('[Resend] Failed to parse response body', {
              statusCode: response.statusCode,
              message: error.message,
              responseBody
            });
          }

          const logContext = {
            statusCode: response.statusCode,
            headers: response.headers,
            responseBody: parsedBody || responseBody
          };

          if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log('[Resend] OTP email sent successfully', {
              to,
              emailId: parsedBody && parsedBody.id ? parsedBody.id : null,
              subject,
              ...logContext
            });
            resolve({
              ok: true,
              status: response.statusCode,
              id: parsedBody && parsedBody.id ? parsedBody.id : null
            });
            return;
          }

          const error = new Error('Resend API request failed');
          error.status = response.statusCode;
          error.responseBody = parsedBody || responseBody;

          console.error('[Resend] OTP email send failed', {
            to,
            subject,
            ...logContext
          });
          reject(error);
        });
      }
    );

    request.on('timeout', () => {
      console.error('[Resend] Request timed out', {
        host: RESEND_API_HOST,
        path: RESEND_API_PATH,
        to,
        subject
      });
      request.destroy(new Error('Resend API request timed out'));
    });

    request.on('error', (error) => {
      console.error('[Resend] Request error', {
        to,
        subject,
        code: error.code,
        message: error.message
      });
      reject(error);
    });

    request.write(payload);
    request.end();
  });
}

async function sendEmailOtp({ uhid, email, name }) {
  const key = normalizeKey(uhid);
  if (!key) {
    return { ok: false, status: 400, message: 'UHID is required' };
  }
  if (!email) {
    return { ok: false, status: 400, message: 'Registered email not found for this UHID' };
  }

  const now = Date.now();
  const record = otpStore.get(key) || { requests: [] };
  pruneRequests(record, now);

  if (record.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - record.requests[0]);
    return {
      ok: false,
      status: 429,
      message: 'Too many OTP requests. Please try again later.',
      retryAfterMs: Math.max(retryAfterMs, 0)
    };
  }

  const otp = generateOtp();

  record.requests.push(now);
  record.email = email;
  record.name = name || '';

  try {
    const emailResult = await sendOtpEmail({
      to: email,
      otp,
      name: name || 'Patient'
    });

    if (!emailResult.ok) {
      return {
        ok: false,
        status: emailResult.status || 502,
        message: 'Failed to send OTP email'
      };
    }
  } catch (error) {
    console.error('[Resend] Failed to send OTP email', {
      to: email,
      status: error.status || null,
      code: error.code || null,
      responseBody: error.responseBody || null,
      message: error.message
    });
    record.otp = null;
    otpStore.set(key, record);
    throw error;
  }

  record.otp = buildOtpRecord(now, email, name || '', otp).otp;
  otpStore.set(key, record);

  return {
    ok: true,
    expiresAt: record.otp.expiresAt,
    maskedEmail: maskEmail(email)
  };
}

function verifyEmailOtp({ uhid, otp }) {
  const key = normalizeKey(uhid);
  const inputOtp = String(otp || '').trim();
  if (!key) {
    return { ok: false, status: 400, message: 'UHID is required' };
  }
  if (!/^\d{6}$/.test(inputOtp)) {
    return { ok: false, status: 400, message: 'OTP must be exactly 6 digits' };
  }

  const record = otpStore.get(key);
  const verification = validateOtpRecord(record, inputOtp, key, otpStore);
  if (!verification.ok) {
    return verification;
  }

  record.otp.used = true;
  otpStore.delete(key);
  return { ok: true };
}

async function sendDoctorAccessOtp({ doctorId, uhid, email, name }) {
  const key = buildDoctorAccessKey(doctorId, uhid);
  if (!normalizeDoctorKey(doctorId)) {
    return { ok: false, status: 400, message: 'Doctor ID is required' };
  }
  if (!normalizeKey(uhid)) {
    return { ok: false, status: 400, message: 'UHID is required' };
  }
  if (!email) {
    return { ok: false, status: 400, message: 'Registered email not found for this UHID' };
  }

  const now = Date.now();
  const record = doctorAccessOtpStore.get(key) || { requests: [] };
  pruneRequests(record, now);

  if (record.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - record.requests[0]);
    return {
      ok: false,
      status: 429,
      message: 'Too many OTP requests. Please try again later.',
      retryAfterMs: Math.max(retryAfterMs, 0)
    };
  }

  const otp = generateOtp();

  record.requests.push(now);
  record.email = email;
  record.name = name || '';
  record.otp = buildOtpRecord(now, email, name || '', otp).otp;
  doctorAccessGrantStore.delete(key);

  try {
    const emailResult = await dispatchOtpEmail({
      to: email,
      otp,
      name: name || 'Patient',
      subject: 'Doctor access OTP for your NexHealth Pro record',
      introLine: `A doctor is requesting access to your NexHealth Pro record for UHID ${normalizeKey(uhid)}.`
    });

    if (!emailResult.ok) {
      return {
        ok: false,
        status: emailResult.status || 502,
        message: 'Failed to send OTP email'
      };
    }
  } catch (error) {
    console.error('[Resend] Failed to send doctor access OTP email', {
      doctorId,
      uhid: normalizeKey(uhid),
      to: email,
      status: error.status || null,
      code: error.code || null,
      responseBody: error.responseBody || null,
      message: error.message
    });
    record.otp = null;
    doctorAccessOtpStore.set(key, record);
    throw error;
  }

  doctorAccessOtpStore.set(key, record);
  return {
    ok: true,
    expiresAt: record.otp.expiresAt,
    maskedEmail: maskEmail(email)
  };
}

function verifyDoctorAccessOtp({ doctorId, uhid, otp }) {
  const key = buildDoctorAccessKey(doctorId, uhid);
  const inputOtp = String(otp || '').trim();
  const normalizedUhid = normalizeKey(uhid);
  const normalizedDoctorId = normalizeDoctorKey(doctorId);

  if (!normalizedDoctorId) {
    return { ok: false, status: 400, message: 'Doctor ID is required' };
  }
  if (!normalizedUhid) {
    return { ok: false, status: 400, message: 'UHID is required' };
  }
  if (!/^\d{6}$/.test(inputOtp)) {
    return { ok: false, status: 400, message: 'OTP must be exactly 6 digits' };
  }

  const record = doctorAccessOtpStore.get(key);
  const verification = validateOtpRecord(record, inputOtp, key, doctorAccessOtpStore);
  if (!verification.ok) {
    return verification;
  }

  const grantedAt = Date.now();
  const expiresAt = grantedAt + DOCTOR_ACCESS_EXPIRY_MS;

  record.otp.used = true;
  doctorAccessOtpStore.delete(key);
  doctorAccessGrantStore.set(key, {
    doctorId: normalizedDoctorId,
    uhid: normalizedUhid,
    grantedAt,
    expiresAt
  });

  console.log('[DoctorAccess] Access granted', {
    doctorId: normalizedDoctorId,
    patientUhid: normalizedUhid,
    accessTimestamp: new Date(grantedAt).toISOString()
  });

  return {
    ok: true,
    grantedAt,
    expiresAt
  };
}

function getDoctorAccessGrant({ doctorId, uhid }) {
  const key = buildDoctorAccessKey(doctorId, uhid);
  const grant = doctorAccessGrantStore.get(key);
  const now = Date.now();

  if (!grant) {
    return { ok: false, status: 403, message: 'Doctor access requires OTP verification.' };
  }

  if (grant.expiresAt <= now) {
    doctorAccessGrantStore.delete(key);
    return { ok: false, status: 403, message: 'Doctor access has expired. Request a new OTP.' };
  }

  return { ok: true, grantedAt: grant.grantedAt, expiresAt: grant.expiresAt };
}

module.exports = {
  sendEmailOtp,
  sendDoctorAccessOtp,
  sendOtpEmail,
  getDoctorAccessGrant,
  verifyDoctorAccessOtp,
  verifyEmailOtp,
  maskEmail
};
