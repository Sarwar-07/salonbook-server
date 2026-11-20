import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { verifyJWT } from './middlewares/authMiddleware.js';
import { requestLogger, notFoundHandler } from './middlewares/loggerMiddleware.js';
import serviceRoutes from './routes/serviceRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import paymentRoutes, { stripeWebhookHandler } from './routes/paymentRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL || 'http://localhost:3000'],
    credentials: true,
  })
);

// Request logger near the top of the middleware chain
app.use(requestLogger);

// Async database-readiness middleware ensuring MongoDB connection before route execution
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Stripe webhook must receive raw body, mounted BEFORE express.json()
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());
app.use('/api', authRoutes);
app.use('/api', serviceRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', userRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', paymentRoutes);

app.get('/', (req, res) => {
  res.send({ status: 'ok', message: 'SalonBook API Server is running' });
});

// Protected route to get current authenticated user profile
app.get('/api/me', verifyJWT, (req, res) => {
  res.send({ user: req.user });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global Express error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).send({
    message: err.message || 'Internal Server Error',
  });
});

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`SalonBook server listening on port ${port}`);
  });
}

export default app;
if (typeof module !== 'undefined') {
  module.exports = app;
}
