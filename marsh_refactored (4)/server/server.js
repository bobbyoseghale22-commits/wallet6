const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

const config = require('./config');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/validate');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Render / proxies sit in front of the app — needed for secure cookies & rate limit
app.set('trust proxy', 1);

/* ---------------------------------- Security --------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

/* ------------------------------------ CORS ----------------------------------- */
const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / server-to-server (no origin) and configured origins
    if (!origin) return callback(null, true);
    if (!config.clientOrigins.length || config.clientOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors(corsOptions));

/* ---------------------------------- Parsers ---------------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.sessionSecret));

/* ------------------------------- Rate limiting ------------------------------- */
app.use('/api', apiLimiter);

/* ----------------------------------- CSRF ------------------------------------ */
// Double-submit cookie pattern. The token is exposed via GET /api/csrf-token
// and must be echoed back in the X-CSRF-Token header on mutating requests.
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
  },
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/* ----------------------------------- Health ---------------------------------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'marsh', time: new Date().toISOString() });
});

/* ----------------------------------- Routes ---------------------------------- */
// Auth routes are CSRF-protected (login/register/logout are state-changing).
app.use('/api/auth', csrfProtection, authRoutes);
app.use('/api/user', csrfProtection, userRoutes);
app.use('/api/admin', csrfProtection, adminRoutes);

/* ----------------------------- Static frontend ------------------------------- */
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// Pretty routes -> serve the matching HTML page
const pages = {
  '/': 'index.html',
  '/dashboard': 'dashboard.html',
  '/profile': 'profile.html',
  '/admin': 'admin.html',
  '/login': 'login.html',
  '/register': 'register.html',
};
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(clientDir, file)));
});

/* ------------------------------- Error handling ------------------------------ */
app.use('/api', notFound);
app.use(errorHandler);

/* ------------------------------------ Boot ----------------------------------- */
const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`Marsh server running on port ${config.port} [${config.env}]`);
  });
};

start();

module.exports = app;
