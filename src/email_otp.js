const crypto = require('crypto');
const https = require('https');

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const RESEND_API_HOST = 'api.resend.com';
const RESEND_API_PATH = '/emails';

const otpStore = new Map();

function normalizeKey(uhid) {
  return String(uhid || '').trim().toUpperCase();
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_USER;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required');
  }

  if (!fromEmail) {
    throw new Error('RESEND_FROM_EMAIL or EMAIL_USER is required');
  }

  return { apiKey, fromEmail };
}

function sendOtpEmail({ to, otp, name }) {
  const { apiKey, fromEmail } = getResendConfig();
  const payload = JSON.stringify({
    from: fromEmail,
    to: [to],
    subject: 'Your NexHealth Pro login OTP',
    text: [
      `Hello ${name || 'Patient'},`,
      '',
      `Your login OTP is: ${otp}`,
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
        to
      });
      request.destroy(new Error('Resend API request timed out'));
    });

    request.on('error', (error) => {
      console.error('[Resend] Request error', {
        to,
        code: error.code,
        message: error.message
      });
      reject(error);
    });

    request.write(payload);
    request.end();
  });
}

function pruneRequests(record, now) {
  record.requests = record.requests.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
}

function cleanupExpired(key, record, now) {
  if (!record || record.expiresAt <= now || record.used) {
    otpStore.delete(key);
    return true;
  }
  return false;
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
  const salt = crypto.randomBytes(16).toString('hex');
  const expiresAt = now + OTP_EXPIRY_MS;

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

  record.otp = {
    hash: hashOtp(otp, salt),
    salt,
    expiresAt,
    used: false
  };
  otpStore.set(key, record);

  return {
    ok: true,
    expiresAt,
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
  const now = Date.now();
  if (!record || !record.otp || cleanupExpired(key, record, now)) {
    return { ok: false, status: 400, message: 'OTP expired or not found. Please request a new one.' };
  }

  if (record.otp.used) {
    otpStore.delete(key);
    return { ok: false, status: 400, message: 'OTP has already been used. Please request a new one.' };
  }

  if (record.otp.expiresAt < now) {
    otpStore.delete(key);
    return { ok: false, status: 400, message: 'OTP expired. Please request a new one.' };
  }

  const inputHash = hashOtp(inputOtp, record.otp.salt);
  if (inputHash !== record.otp.hash) {
    return { ok: false, status: 400, message: 'Invalid OTP' };
  }

  record.otp.used = true;
  otpStore.delete(key);
  return { ok: true };
}

module.exports = {
  sendEmailOtp,
  sendOtpEmail,
  verifyEmailOtp,
  maskEmail
};
