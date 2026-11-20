# SalonBook API Server

A production-ready REST API backend for the **SalonBook** salon management and appointment booking platform. Built with Node.js, Express, MongoDB Atlas, JSON Web Tokens (JWT), and Stripe Checkout.

---

## 🛠️ Tech Stack & Key Libraries

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Framework**: Express.js 5
- **Database**: MongoDB Atlas via modern `mongodb` official driver (v7)
- **Authentication**: Stateless JSON Web Tokens (`jsonwebtoken`)
- **Payments**: Stripe Checkout & Webhooks (`stripe`)
- **Security & Utilities**: CORS, Dotenv, Node.js DNS resolution hardening

---

## 📂 Project Structure

```
salonbook-server/
├── config/
│   └── db.js                 # MongoDB connection caching & performance/uniqueness index initialization
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
│   └── verify-api.js         # End-to-end automated verification script
├── index.js                  # Express entry point, middleware chain, and server listener
├── vercel.json               # Vercel serverless deployment configuration
├── package.json              # NPM scripts and dependencies
└── .env                      # Environment variables configuration
```

---

## ⚙️ Environment Variables

The server configuration relies on the following environment variables (defined in `.env`):

| Variable | Description |
|---|---|
| `PORT` | Local server port (Default: `5000`) |
| `MONGODB_URI` | MongoDB Atlas cluster connection URI |
| `DB_NAME` | Target database name (`salonbook_db`) |
| `JWT_SECRET` | Secret key for signing and verifying JSON Web Tokens |
| `STRIPE_SECRET_KEY` | Stripe secret API key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `CLIENT_URL` | Frontend origin for CORS and checkout redirects (e.g. `http://localhost:3000`) |
| `NODE_ENV` | Environment mode (`development` / `production`) |

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database
Seed demo accounts (`admin@salonbook.com`, `customer@salonbook.com`) and 12 salon services across 5 categories:
```bash
npm run seed
```

### 3. Run Development Server
```bash
npm run dev
# Or for standard production start:
npm start
```

### 4. Run Automated End-to-End API Verification
With the server running on `http://localhost:5000`:
```bash
npm run verify
```

---

## 📖 API Documentation

All routes (except root `/`) are prefixed with `/api`.

### 1. Health Check
- **`GET /`**
  - **Access**: Public
  - **Response (200)**:
    ```json
    { "status": "ok", "message": "SalonBook API Server is running" }
    ```

---

### 2. Authentication & Authorization

#### `POST /api/auth/jwt`
- **Access**: Public
- **Description**: Authenticate or sync user account from client (e.g. Firebase Auth) and issue a 7-day signed JWT. Backfills name or image if missing, preserves role, and verifies account suspension.
- **Request Body**:
  ```json
  {
    "email": "customer@salonbook.com",
    "name": "Sophia Laurent",
    "image": "https://images.unsplash.com/photo-1534528741775-53994a69daeb"
  }
  ```
- **Response (200)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "673f...",
      "name": "Sophia Laurent",
      "email": "customer@salonbook.com",
      "image": "https://...",
      "phone": "",
      "role": "customer",
      "isBlocked": false
    }
  }
  ```
- **Errors**: `400` (Invalid email), `403` (Account suspended).

#### `GET /api/me`
- **Access**: Protected (`verifyJWT`)
- **Headers**: `Authorization: Bearer <token>`
- **Response (200)**:
  ```json
  {
    "user": {
      "_id": "673f...",
      "name": "Sophia Laurent",
      "email": "customer@salonbook.com",
      "image": "https://...",
      "phone": "",
      "role": "customer",
      "isBlocked": false
    }
  }
  ```

---

### 3. Salon Services

#### `GET /api/services`
- **Access**: Public
- **Query Parameters**:
  - `search`: Case-insensitive regex search on `serviceName`.
  - `category`: Filter by category (e.g., `'Hair'`, `'Skin'`, `'Makeup'`, `'Spa'`, `'Nails'`). Omits filter if `'All'`.
  - `sort`: `'price_asc'` (`{ price: 1 }`), `'price_desc'` (`{ price: -1 }`), default `{ createdAt: -1 }`.
  - `limit`: Optional positive integer to limit results.
- **Response (200)**: Array of active service objects.

#### `GET /api/services/:id`
- **Access**: Public
- **Response (200)**: Service object matching `_id`.
- **Errors**: `400` (Invalid ObjectId format), `404` (Service not found).

#### `GET /api/admin/services`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Response (200)**: Array of all services (`active` and `inactive`) sorted by `{ createdAt: -1 }`.

#### `POST /api/services`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Request Body**:
  ```json
  {
    "serviceName": "Signature Blowout",
    "category": "Hair",
    "description": "Professional hair wash and blowout.",
    "image": "https://images.unsplash.com/photo-1560869713-7d0a29430803",
    "price": 55,
    "duration": 45,
    "status": "active"
  }
  ```
- **Response (201)**: `{ "message": "Service created successfully", "service": { ... } }`

#### `PATCH /api/services/:id`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Request Body**: Any subset of `serviceName`, `category`, `description`, `image`, `price`, `duration`, `status` (`'active'` or `'inactive'`).
- **Response (200)**: `{ "message": "Service updated successfully", "service": { ... } }`

#### `DELETE /api/services/:id`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Response (200)**: `{ "message": "Service deleted successfully" }`

---

### 4. Appointment Booking & Management

#### `GET /api/appointments/booked-slots`
- **Access**: Public
- **Query Parameters**: `serviceId` (`ObjectId`), `date` (`YYYY-MM-DD`).
- **Response (200)**: Array of booked `timeSlot` strings where status is not cancelled.
  ```json
  ["10:00 AM", "02:00 PM"]
  ```

#### `POST /api/appointments`
- **Access**: Protected (`verifyJWT, verifyCustomer`)
- **Request Body**:
  ```json
  {
    "serviceId": "673f...",
    "appointmentDate": "2026-12-25",
    "timeSlot": "10:00 AM",
    "notes": "First time visit"
  }
  ```
- **Response (201)**:
  ```json
  {
    "message": "Appointment booked successfully",
    "appointment": {
      "_id": "6740...",
      "customerId": "673f...",
      "customerName": "Sophia Laurent",
      "customerEmail": "customer@salonbook.com",
      "serviceId": "673f...",
      "serviceName": "Signature Blowout",
      "serviceCategory": "Hair",
      "serviceImage": "https://...",
      "price": 55,
      "duration": 45,
      "appointmentDate": "2026-12-25",
      "timeSlot": "10:00 AM",
      "notes": "First time visit",
      "status": "pending",
      "paymentStatus": "unpaid",
      "createdAt": "2026-11-20T18:00:00.000Z"
    }
  }
  ```
- **Errors**: `400` (Validation), `404` (Service not found), `409 Conflict` (`"This time slot is already booked for the selected date."`).

#### `GET /api/appointments/my`
- **Access**: Protected (`verifyJWT`)
- **Response (200)**: Array of appointments for logged-in user sorted by `{ createdAt: -1 }`.

#### `PATCH /api/appointments/:id/cancel`
- **Access**: Protected (`verifyJWT`)
- **Description**: Allows customer to cancel their own `'pending'` appointment.
- **Response (200)**: `{ "message": "Appointment cancelled successfully", "appointment": { ... } }`

#### `GET /api/admin/appointments`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Query Parameters**: `status` (Optional filter: `'pending'`, `'confirmed'`, `'completed'`, `'cancelled'`).
- **Response (200)**: Array of all appointments sorted by `{ createdAt: -1 }`.

#### `PATCH /api/admin/appointments/:id/status`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Request Body**: `{ "status": "confirmed" | "completed" | "cancelled" | "pending" }`
- **Response (200)**: `{ "message": "Appointment status updated successfully", "appointment": { ... } }`

---

### 5. Customer Profile & User Management

#### `PATCH /api/users/profile`
- **Access**: Protected (`verifyJWT`)
- **Request Body**:
  ```json
  {
    "name": "Sophia Laurent Updated",
    "phone": "+1 (555) 876-5432",
    "image": "https://..."
  }
  ```
- **Response (200)**: `{ "message": "Profile updated successfully", "user": { ... } }`

#### `GET /api/admin/users`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Response (200)**: Array of all users sorted by `{ createdAt: -1 }` (passwords excluded).

#### `PATCH /api/admin/users/:id/role`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Request Body**: `{ "role": "admin" | "customer" }`
- **Security**: Prevents self-demotion (`400 Bad Request` if `req.user._id === id`).
- **Response (200)**: `{ "message": "User role updated successfully", "user": { ... } }`

#### `PATCH /api/admin/users/:id/block`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Request Body**: `{ "isBlocked": true | false }`
- **Security**: Prevents self-blocking (`400 Bad Request` if `req.user._id === id`).
- **Response (200)**: `{ "message": "User block status updated successfully", "user": { ... } }`

---

### 6. Dashboard Analytics & Stats

#### `GET /api/dashboard/customer-stats`
- **Access**: Protected (`verifyJWT`)
- **Response (200)**:
  ```json
  {
    "stats": {
      "totalAppointments": 4,
      "pendingAppointments": 1,
      "confirmedAppointments": 1,
      "completedAppointments": 1,
      "totalSpent": 120
    },
    "recentAppointments": [ ... ]
  }
  ```

#### `GET /api/dashboard/admin-stats`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Response (200)**:
  ```json
  {
    "stats": {
      "totalUsers": 15,
      "totalServices": 12,
      "activeServices": 12,
      "totalAppointments": 28,
      "totalRevenue": 2450,
      "statusBreakdown": {
        "pending": 5,
        "confirmed": 12,
        "completed": 9,
        "cancelled": 2
      }
    },
    "categoryRevenue": [
      { "category": "Hair", "revenue": 1150, "bookings": 14 },
      { "category": "Skin", "revenue": 800, "bookings": 7 }
    ],
    "recentAppointments": [ ... ],
    "recentTransactions": [ ... ]
  }
  ```

---

### 7. Payments & Stripe Integration

#### `POST /api/payments/create-checkout-session`
- **Access**: Protected (`verifyJWT`)
- **Request Body**: `{ "appointmentId": "6740..." }`
- **Response (200)**:
  ```json
  {
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "sessionId": "cs_test_..."
  }
  ```

#### `POST /api/payments/webhook`
- **Access**: Public (Stripe Signature Verified via `express.raw({ type: 'application/json' })`)
- **Headers**: `stripe-signature: t=...,v1=...`
- **Description**: Listens for `checkout.session.completed`, executes idempotent transaction insertion, updates `appointmentsCollection` (`paymentStatus: 'paid'`, `stripeSessionId`, `paidAt`), and promotes status from `'pending'` to `'confirmed'`.
- **Response (200)**: `{ "received": true }`

#### `POST /api/payments/verify-session`
- **Access**: Protected (`verifyJWT`)
- **Description**: Fallback verification endpoint for client return (`/payment/success?session_id=...`). Retrieves session from Stripe and performs idempotent fulfillment if paid.
- **Request Body**: `{ "sessionId": "cs_test_..." }`
- **Response (200)**: `{ "status": "paid", "appointmentId": "6740..." }`

#### `GET /api/transactions/my`
- **Access**: Protected (`verifyJWT`)
- **Response (200)**: Array of transaction records for authenticated customer sorted by `{ createdAt: -1 }`.

#### `GET /api/admin/transactions`
- **Access**: Protected (`verifyJWT, verifyAdmin`)
- **Response (200)**: Array of all payment transaction records sorted by `{ createdAt: -1 }`.

---

## ☁️ Vercel Deployment

This project includes [vercel.json](file:///d:/Work/Programming%20Hero/Assaingment/Assignment-9/salonbook-server/vercel.json) preconfigured for serverless Node.js deployment.

### Steps to Deploy:
1. Push the repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New > Project** and import the repository.
3. In **Settings > Environment Variables**, configure all production keys:
   - `MONGODB_URI`
   - `DB_NAME`
   - `JWT_SECRET`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `CLIENT_URL`
   - `NODE_ENV=production`
4. Deploy. The backend API will be live at `https://<your-project>.vercel.app`.
