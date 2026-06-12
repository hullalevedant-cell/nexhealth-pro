// PostgreSQL connection pool for Supabase / PostgreSQL usage
// This file is separate from the existing SQLite database code.
// It uses DATABASE_URL from environment variables.

const { Pool } = require('pg');
const dns = require('dns');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

let pool = global.__nexhealthPgPool || null;

const isValidPgUrl = connectionString && /^postgres(ql)?:\/\//i.test(connectionString);

function logPgError(context, error) {
  console.error(`[Postgres] ${context}:`, {
    message: error?.message || null,
    code: error?.code || null,
    errno: error?.errno || null,
    syscall: error?.syscall || null,
    hostname: error?.hostname || null,
    address: error?.address || null,
    port: error?.port || null
  });
}

if (isValidPgUrl) {
  if (!pool) {
    pool = new Pool({
      connectionString,
      family: 4,
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { ...options, family: 4, all: false, verbatim: false }, callback);
      },
      ssl: {
        rejectUnauthorized: false
      }
    });

    pool.on('error', (error) => {
      logPgError('pool error', error);
    });

    pool.on('connect', (client) => {
      client.on('error', (error) => {
        logPgError('client error', error);
      });
    });

    global.__nexhealthPgPool = pool;
    console.log('Postgres pool initialized');
  }
} else if (connectionString) {
  console.warn('Invalid DATABASE_URL format. Expected postgres:// or postgresql://');
} else {
  console.warn('DATABASE_URL not set: Postgres pool not initialized');
}

module.exports = pool;
