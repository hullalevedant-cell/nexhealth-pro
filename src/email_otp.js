const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const nodemailer = require('nodemailer');

dns.setDefaultResultOrder('ipv4first');

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;

const otpStore = new Map();
let transporter = null;

function normalizeKey(uhid) {
  return String(uhid || '').trim().toUpperCase();
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS are required');
  }

  const resolveSmtpHostIpv4 = () =>
    new Promise((resolve, reject) => {
      dns.lookup(SMTP_HOST, { family: 4 }, (error, address, family) => {
        if (error) {
          console.error('[SMTP] IPv4 DNS lookup failed', {
            host: SMTP_HOST,
            code: error.code,
            message: error.message
          });
          reject(error);
          return;
        }

        console.log('[SMTP] Resolved Gmail SMTP over IPv4', {
          host: SMTP_HOST,
          address,
          family
        });
        resolve(address);
      });
    });

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user,
      pass
    },
    family: 4,
    logger: true,
    debug: true,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      servername: SMTP_HOST,
      minVersion: 'TLSv1.2'
    },
    getSocket: async (options, callback) => {
      try {
        const address = await resolveSmtpHostIpv4();
        const socket = net.connect({
          host: address,
          port: options.port || SMTP_PORT,
          family: 4
        });
        let settled = false;

        socket.setTimeout(options.connectionTimeout || 30000);

        socket.once('lookup', (error, resolvedAddress, family, host) => {
          if (error) {
            console.error('[SMTP] Socket lookup error', {
              host,
              code: error.code,
              message: error.message
            });
            return;
          }

          console.log('[SMTP] Socket lookup complete', {
            host,
            resolvedAddress,
            family
          });
        });

        socket.once('connect', () => {
          console.log('[SMTP] Connected to Gmail SMTP', {
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            localAddress: socket.localAddress,
            localPort: socket.localPort
          });

          if (!settled) {
            settled = true;
            callback(null, {
              connection: socket
            });
          }
        });

        socket.once('timeout', () => {
          console.error('[SMTP] Connection timed out', {
            host: SMTP_HOST,
            port: options.port || SMTP_PORT
          });
          socket.destroy(new Error('SMTP connection timed out'));
        });

        socket.once('error', (error) => {
          console.error('[SMTP] Connection error', {
            host: SMTP_HOST,
            port: options.port || SMTP_PORT,
            code: error.code,
            message: error.message
          });

          if (!settled) {
            settled = true;
            callback(error);
          }
        });

        socket.once('close', (hadError) => {
          console.log('[SMTP] Connection closed', {
            hadError,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort
          });
        });
      } catch (error) {
        console.error('[SMTP] Failed to prepare IPv4 socket', {
          host: SMTP_HOST,
          port: options.port || SMTP_PORT,
          code: error.code,
          message: error.message
        });
        callback(error);
      }
    }
  });

  return transporter;
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

  const mailer = getTransporter();
  try {
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
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
  } catch (error) {
    console.error('[SMTP] Failed to send OTP email', {
      to: email,
      code: error.code,
      command: error.command,
      response: error.response,
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
  verifyEmailOtp,
  maskEmail
};
