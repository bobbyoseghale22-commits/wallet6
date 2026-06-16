/**
 * Centralized configuration.
 * All environment variables are read here so the rest of the app
 * has a single source of truth.
 */
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,

  mongoUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  sessionSecret: process.env.SESSION_SECRET,

  // Comma-separated list of allowed origins, or "*" in dev
  clientOrigins: (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

config.isProd = config.env === 'production';

// Fail fast in production if critical secrets are missing
if (config.isProd) {
  const required = ['mongoUri', 'jwtSecret', 'sessionSecret'];
  const missing = required.filter((k) => !config[k]);
  if (missing.length) {
    console.error(`FATAL: Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = config;
