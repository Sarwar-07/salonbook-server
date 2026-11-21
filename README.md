# SalonBook API Server — Salon Appointment Booking Platform

Node.js/Express REST API powering authentication sync, service management, conflict-free appointment scheduling, role-based dashboards, and Stripe Checkout + webhook fulfillment.

---

## 🔗 Live Links & Repositories

- **Live API Server:** [https://salonbook-server-eight.vercel.app](https://salonbook-server-eight.vercel.app)
- **Live Client Website:** [https://salonbook-client-three.vercel.app](https://salonbook-client-three.vercel.app)
- **Server Repository:** [https://github.com/Sarwar-07/salonbook-server](https://github.com/Sarwar-07/salonbook-server)
- **Client Repository:** [https://github.com/Sarwar-07/salonbook-client](https://github.com/Sarwar-07/salonbook-client)

---

## ✨ Important Features & Core API Modules

- **JWT Authentication & Role Security:** Stateless JWT issuance (`/api/auth/jwt`) with account status checks (`isBlocked`) and middleware guards (`verifyJWT`, `verifyAdmin`, `verifyCustomer`).
- **Salon Services Management:** Public search, category filtering, and price sorting (`/api/services`), alongside protected Admin CRUD operations (`/api/admin/services`).
- **Double-Booking Conflict Prevention:** Real-time slot availability check (`/api/appointments/booked-slots`) and appointment booking with atomic conflict detection returning `409 Conflict` if the service, date, and time slot are already reserved (`/api/appointments`).
- **Appointment Status Controls:** Customer appointment cancellation (`/api/appointments/:id/cancel`) and Admin lifecycle management (`pending` ➔ `confirmed` ➔ `completed` / `cancelled`) via `/api/admin/appointments`.
- **Stripe Checkout & Webhook Fulfillment:**
  - Secure Checkout session generation for `confirmed` and `unpaid` appointments only (`/api/payments/create-checkout-session`).
  - Webhook signature verification (`checkout.session.completed`) with idempotent transaction creation and appointment payment status updates (`/api/payments/webhook`).
  - Read-only transaction ledger for customers and administrators (`/api/transactions/my`, `/api/admin/transactions`) with enriched appointment date tracking.
- **Analytics & Role-Based Dashboards:**
  - Customer statistics (`/api/dashboard/customer-stats`): `totalAppointments`, `pendingAppointments`, `confirmedAppointments`, `completedAppointments`, `cancelledAppointments`, `totalSpent`, and recent bookings.
  - Admin KPI analytics (`/api/dashboard/admin-stats`): `totalCustomers`, `activeServices`, `totalAppointments`, `pendingAppointments`, `confirmedAppointments`, `successfulPayments`, `totalUsers`, `totalServices`, `totalRevenue`, and category revenue aggregations.
- **User Management:** Customer profile self-update (`/api/users/profile`) and Admin user control (`/api/admin/users`) with role assignments and account suspension safeguards preventing self-demotion or self-blocking.

---

## 🛠️ Technology Stack

- **Runtime & Framework:** Node.js (ES Modules), Express.js 5
- **Database:** MongoDB Atlas (native official `mongodb` driver)
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), CORS
- **Payments:** Stripe SDK (`stripe`)
- **Configuration & Utilities:** `dotenv`, custom logging, connection pooling & caching

---

## ⚙️ Required Environment Variables

Create a `.env` file in the root directory. Configure the following variable names (do not commit secret values to version control):

| Variable Name | Description |
|---|---|
| `PORT` | Local server port (e.g. `5000`) |
| `MONGODB_URI` | MongoDB Atlas connection string URI |
| `DB_NAME` | Target database name (e.g. `salonbook_db`) |
| `JWT_SECRET` | Secret key used for signing and verifying JSON Web Tokens |
| `STRIPE_SECRET_KEY` | Stripe secret API key (starts with `sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (starts with `whsec_...`) |
| `CLIENT_URL` | Frontend origin URL for CORS policy and Stripe redirect callbacks |
| `NODE_ENV` | Runtime environment mode (`development` or `production`) |

> [!IMPORTANT]
> Never expose or commit real secrets, private keys, or credentials into public repositories.

---

## 🚀 Installation & Running Locally

### 1. Clone the Repository
```bash
git clone https://github.com/Sarwar-07/salonbook-server.git
cd salonbook-server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the project root and fill in the required variables as described in the [Required Environment Variables](#️-required-environment-variables) section.

### 4. Seed Database (Optional)
Seed initial demo users (`admin@salonbook.com`, `customer@salonbook.com`) and 12 sample salon services across 5 categories:
```bash
npm run seed
```

### 5. Run the Server
```bash
# Start with hot-reloading (Node watch mode):
npm run dev

# Or start in standard mode:
npm start
```
The server will start at `http://localhost:5000`.

### 6. Run API Verification Suite
Run the automated end-to-end verification script:
```bash
npm run verify
```

---

## 📂 Project Structure

```
salonbook-server/
├── config/
│   └── db.js                 # MongoDB connection caching, serverless DNS guards & index initialization
├── middlewares/
│   ├── authMiddleware.js     # verifyJWT, verifyAdmin, verifyCustomer
│   └── loggerMiddleware.js   # requestLogger, notFoundHandler (404)
├── routes/
│   ├── appointmentRoutes.js  # Booking, booked slots, cancellation, admin status updates
│   ├── authRoutes.js         # User registration/sync & JWT issuance
│   ├── dashboardRoutes.js    # Customer & Admin stats and chart analytics aggregations
│   ├── paymentRoutes.js      # Stripe checkout, webhook, verify fallback, transactions
│   ├── serviceRoutes.js      # Public service listing, filtering, search, and Admin CRUD
│   └── userRoutes.js         # Customer profile update and Admin user management
├── scripts/
│   ├── seed.js               # Database seeding script for demo users and services
│   └── verify-api.js         # End-to-end automated API test suite
├── index.js                  # Express entry point, middleware chain, and server listener
├── vercel.json               # Vercel serverless deployment configuration
├── package.json              # NPM scripts and dependencies
└── README.md                 # Project documentation
```

---

## 📖 API Reference Overview

All API endpoints are prefixed with `/api` (except the root health check `/`).

### Health Check
- `GET /` — Service health check status (`200 OK`)

### Authentication & Current User
- `POST /api/auth/jwt` — Exchange user profile details for a signed JWT token
- `GET /api/me` — Retrieve current authenticated user profile (`verifyJWT`)

### Services
- `GET /api/services` — Public active services list (supports `search`, `category`, `sort`, `limit`)
- `GET /api/services/:id` — Public single service details
- `GET /api/admin/services` — Admin view of all services including inactive (`verifyJWT`, `verifyAdmin`)
- `POST /api/services` — Admin create service (`verifyJWT`, `verifyAdmin`)
- `PATCH /api/services/:id` — Admin update service (`verifyJWT`, `verifyAdmin`)
- `DELETE /api/services/:id` — Admin delete service (`verifyJWT`, `verifyAdmin`)

### Appointments
- `GET /api/appointments/booked-slots` — Public booked time slots for a given `serviceId` and `date`
- `POST /api/appointments` — Book an appointment with double-booking conflict check (`verifyJWT`, `verifyCustomer`)
- `GET /api/appointments/my` — Customer view of their appointments (`verifyJWT`)
- `PATCH /api/appointments/:id/cancel` — Customer cancel pending appointment (`verifyJWT`)
- `GET /api/admin/appointments` — Admin view of all appointments (`verifyJWT`, `verifyAdmin`)
- `PATCH /api/admin/appointments/:id/status` — Admin update status (`pending`, `confirmed`, `completed`, `cancelled`)

### Payments & Transactions
- `POST /api/payments/create-checkout-session` — Create Stripe Checkout session for confirmed unpaid appointments (`verifyJWT`)
- `POST /api/payments/webhook` — Stripe webhook listener for `checkout.session.completed` (raw body verified)
- `POST /api/payments/verify-session` — Fallback session verification (`verifyJWT`)
- `GET /api/transactions/my` — Customer transaction history (`verifyJWT`)
- `GET /api/admin/transactions` — Admin transaction ledger with enriched appointment dates (`verifyJWT`, `verifyAdmin`)

### Dashboards & Analytics
- `GET /api/dashboard/customer-stats` — Customer metrics and 5 recent appointments (`verifyJWT`)
- `GET /api/dashboard/admin-stats` — Admin KPI metrics, category revenues, and recent activity (`verifyJWT`, `verifyAdmin`)

### User Management
- `PATCH /api/users/profile` — Update authenticated customer profile (`verifyJWT`)
- `GET /api/admin/users` — Admin view of all users (`verifyJWT`, `verifyAdmin`)
- `PATCH /api/admin/users/:id/role` — Admin promote/demote user role (`verifyJWT`, `verifyAdmin`)
- `PATCH /api/admin/users/:id/block` — Admin suspend/unblock user (`verifyJWT`, `verifyAdmin`)

---

## ☁️ Deployment

Configured for serverless deployment on [Vercel](https://vercel.com) using `@vercel/node`.

### Steps to Deploy:
1. Push repository commits to GitHub.
2. In the [Vercel Dashboard](https://vercel.com), create a new project and import `salonbook-server`.
3. In **Settings > Environment Variables**, supply the production variable values listed in [Required Environment Variables](#️-required-environment-variables).
4. Deploy the application.
