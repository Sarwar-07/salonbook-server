import express from 'express';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { getCollections } from '../config/db.js';
import { verifyJWT, verifyAdmin } from '../middlewares/authMiddleware.js';

dotenv.config();

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const router = express.Router();

// ObjectId validation helper
const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
};

// Reusable idempotent order fulfillment logic
const handleSessionPaymentSuccess = async (session) => {
  const { appointmentId, customerEmail, serviceName } = session.metadata || {};
  if (!appointmentId || !isValidObjectId(appointmentId)) {
    return;
  }

  const { transactionsCollection, appointmentsCollection } = getCollections();

  // Idempotent insert into transactionsCollection (skip if stripeSessionId already exists)
  const existingTransaction = await transactionsCollection.findOne({
    stripeSessionId: session.id,
  });

  if (!existingTransaction) {
    const transactionDoc = {
      appointmentId: new ObjectId(appointmentId),
      customerEmail: customerEmail || '',
      serviceName: serviceName || '',
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || 'usd',
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent ? String(session.payment_intent) : '',
      status: 'paid',
      createdAt: new Date(),
    };
    await transactionsCollection.insertOne(transactionDoc);
  }

  // Update matching appointment: set paymentStatus: 'paid', stripeSessionId, paidAt
  await appointmentsCollection.updateOne(
    { _id: new ObjectId(appointmentId) },
    {
      $set: {
        paymentStatus: 'paid',
        stripeSessionId: session.id,
        paidAt: new Date(),
      },
    }
  );

  // Promote status from 'pending' to 'confirmed'
  await appointmentsCollection.updateOne(
    { _id: new ObjectId(appointmentId), status: 'pending' },
    {
      $set: {
        status: 'confirmed',
      },
    }
  );
};

// Standalone Stripe Webhook handler
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await handleSessionPaymentSuccess(session);
    } catch (err) {
      console.error('Error processing session payment:', err);
      return res.status(500).send({ message: 'Error processing webhook event' });
    }
  }

  res.status(200).send({ received: true });
};

// POST /payments/create-checkout-session (Protected: verifyJWT)
router.post('/payments/create-checkout-session', verifyJWT, async (req, res, next) => {
  try {
    const { appointmentId } = req.body || {};
    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return res.status(400).send({ message: 'Invalid or missing appointmentId format' });
    }

    const { appointmentsCollection } = getCollections();
    const appointment = await appointmentsCollection.findOne({ _id: new ObjectId(appointmentId) });

    if (!appointment) {
      return res.status(404).send({ message: 'Appointment not found' });
    }

    if (appointment.customerEmail !== req.user.email) {
      return res.status(403).send({ message: 'Forbidden: You do not have permission to pay for this appointment' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).send({ message: 'Cannot pay for a cancelled appointment' });
    }

    if (appointment.paymentStatus === 'paid') {
      return res.status(400).send({ message: 'Appointment is already paid' });
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: appointment.serviceName,
              description: `${appointment.appointmentDate} at ${appointment.timeSlot}`,
            },
            unit_amount: Math.round(appointment.price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        appointmentId: appointment._id.toString(),
        customerEmail: req.user.email,
        serviceName: appointment.serviceName,
      },
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&appointment_id=${appointment._id.toString()}`,
      cancel_url: `${clientUrl}/payment/cancel?appointment_id=${appointment._id.toString()}`,
    });

    res.status(200).send({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    next(error);
  }
});

// POST /payments/verify-session (Protected: verifyJWT): Session verification fallback
router.post('/payments/verify-session', verifyJWT, async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).send({ message: 'sessionId is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      await handleSessionPaymentSuccess(session);
    }

    res.status(200).send({
      status: session.payment_status,
      appointmentId: session.metadata?.appointmentId,
    });
  } catch (error) {
    next(error);
  }
});

// GET /transactions/my (Protected: verifyJWT): Return transactions for authenticated customer
router.get('/transactions/my', verifyJWT, async (req, res, next) => {
  try {
    const { transactionsCollection } = getCollections();
    const transactions = await transactionsCollection
      .find({ customerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(transactions);
  } catch (error) {
    next(error);
  }
});

// GET /admin/transactions (Protected: verifyJWT, verifyAdmin): Return all transactions
router.get('/admin/transactions', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { transactionsCollection } = getCollections();
    const transactions = await transactionsCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send(transactions);
  } catch (error) {
    next(error);
  }
});

export default router;
