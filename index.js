import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { verifyJWT } from './middlewares/authMiddleware.js';
import serviceRoutes from './routes/serviceRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL || 'http://localhost:3000'],
    credentials: true,
  })
);

app.use(express.json());
app.use('/api', serviceRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', userRoutes);

app.get('/', (req, res) => {
  res.send({ status: 'ok', message: 'SalonBook API Server is running' });
});

// Protected route to get current authenticated user profile
app.get('/api/me', verifyJWT, (req, res) => {
  res.send({ user: req.user });
});

// Global Express error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).send({
    message: err.message || 'Internal Server Error',
  });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`SalonBook server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to database or start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
