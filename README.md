# Marsh — Secure Crypto. Simplified.

A production-ready full-stack crypto wallet dashboard with email/password JWT
authentication, an admin backend, and a premium dark cyber-fintech UI. Built as
a single deployable monorepo optimized for **Render**.

![tech](https://img.shields.io/badge/stack-Node%20%7C%20Express%20%7C%20MongoDB-3B82F6)

---

## Features

- **Email/password authentication** with bcrypt-hashed credentials
- **JWT auth** stored in secure, HTTP-only cookies with session persistence
- **Registration** with name, email, and password (min. 8 characters)
- **User dashboard** — profile, wallet balance, BTC/ETH/USDT demo wallet cards
- **Profile management** — update name, change password
- **Admin panel** — searchable user table, edit name/email/balance/role,
  reset password, suspend/unsuspend, delete users (role-protected)
- **Security hardening** — Helmet, CORS, rate limiting, CSRF protection, input
  validation, secure cookies, env-based secrets
- **Premium UI** — glassmorphism, neon cyan/blue accents, animated network
  background, floating crypto icons, fully responsive

---

## Tech Stack

| Layer       | Technology                                   |
|-------------|----------------------------------------------|
| Frontend    | HTML5, CSS3, Vanilla JS (responsive)         |
| Backend     | Node.js, Express.js                          |
| Database    | MongoDB Atlas (Mongoose)                     |
| Auth        | JWT, bcrypt, HTTP-only cookies               |
| Deployment  | Render (`render.yaml` blueprint)             |

---

## Project Structure

```
marsh/
├── client/                 # Static frontend (served by Express)
│   ├── index.html          # Landing page
│   ├── login.html          # Sign in page
│   ├── register.html       # Registration page
│   ├── dashboard.html      # User dashboard
│   ├── profile.html        # Profile management
│   ├── admin.html          # Admin panel
│   ├── css/                # style.css, landing.css, app.css
│   ├── js/                 # core, landing, dashboard, profile, admin, login, register
│   └── assets/
├── server/
│   ├── server.js           # App entry: middleware, routes, static serving
│   ├── config/             # env config + Mongo connection
│   ├── models/             # Mongoose User model
│   ├── controllers/        # auth, user, admin logic
│   ├── middleware/         # auth, validation, error handling
│   ├── routes/             # auth, user, admin routes
│   └── utils/              # token, respond, seedAdmin
├── package.json
├── render.yaml
├── .env.example
└── README.md
```

---

## Local Setup

### 1. Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (free tier works)

### 2. Install
```bash
git clone <your-repo-url> marsh
cd marsh
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Fill in `.env`:
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/marsh
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=7d
SESSION_SECRET=<another long random string>
```
> Generate strong secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 4. Run
```bash
npm run dev   # nodemon
# or
npm start
```
Visit **http://localhost:5000**.

---

## Creating the first admin

Register an account through the UI, then promote it to admin:

```bash
node server/utils/seedAdmin.js admin@example.com "Admin Name" StrongPass123
```
- Existing email → promoted to `admin` (password reset if provided).
- New email → creates an admin account with email/password login.

The **Admin** link then appears in the nav for that account.

---

## Deploying to Render

This repo includes a `render.yaml` blueprint that deploys one web service
serving both the API and the static frontend. No Google Cloud configuration
is required.

### Option A — Blueprint (recommended)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo.
3. Render reads `render.yaml`. `JWT_SECRET` and `SESSION_SECRET` are
   auto-generated; set `MONGODB_URI` when prompted.

### Option B — Manual web service
1. **New → Web Service**, connect the repo.
2. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `node server/server.js`
   - **Health check path:** `/api/health`

### Environment variables (Render dashboard)
| Key              | Value                                            |
|------------------|--------------------------------------------------|
| `MONGODB_URI`    | your Atlas connection string                      |
| `JWT_SECRET`     | long random string (auto-generated in blueprint)  |
| `JWT_EXPIRES_IN` | `7d`                                              |
| `SESSION_SECRET` | long random string (auto-generated in blueprint)  |
| `NODE_ENV`       | `production`                                      |

> **MongoDB Atlas:** under Network Access, allow `0.0.0.0/0` (or Render's
> outbound IPs) so the service can connect.

---

## API Reference

### Auth
| Method | Route               | Description                          |
|--------|---------------------|---------------------------------------|
| POST   | `/api/auth/register`| Create an account (name/email/password)|
| POST   | `/api/auth/login`   | Email/password login                  |
| POST   | `/api/auth/logout`  | Clear auth cookie                     |
| GET    | `/api/auth/me`      | Get the current authenticated user    |

### User (auth required)
| Method | Route                | Description            |
|--------|----------------------|------------------------|
| GET    | `/api/user`          | Current user profile   |
| PUT    | `/api/user/update`   | Update name / password |
| GET    | `/api/user/balance`  | Get wallet balance     |
| PUT    | `/api/user/balance`  | Update wallet balance  |

### Admin (admin role required)
| Method | Route                      | Description           |
|--------|----------------------------|-----------------------|
| GET    | `/api/admin/users`         | List/search users     |
| PUT    | `/api/admin/update-user`   | Update any user       |
| DELETE | `/api/admin/user/:id`      | Delete a user         |

### Utility
| Method | Route             | Description            |
|--------|-------------------|------------------------|
| GET    | `/api/health`     | Health check           |
| GET    | `/api/csrf-token` | Fetch a CSRF token     |

> All mutating requests require the `X-CSRF-Token` header (the frontend handles
> this automatically via `core.js`).

---

## Security Notes

- Passwords are **never** stored in plain text — bcrypt with a cost factor of 12.
- `passwordHash` is `select: false` and never serialized in responses.
- JWTs are delivered as `httpOnly`, `secure` (in production), `sameSite` cookies.
- Helmet sets a strict Content-Security-Policy.
- Rate limiting: 300 req/15 min globally, 30 req/15 min on auth routes.
- CSRF protection via the double-submit cookie pattern.
- The demo wallet balances are derived from the stored USD balance for display
  only. In a real wallet, balances must come from a ledgered transaction system,
  never a direct client write.

---

## License

MIT
