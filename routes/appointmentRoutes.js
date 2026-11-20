import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyJWT, verifyAdmin, verifyCustomer } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ObjectId validation helper
const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
};

// GET /appointments/booked-slots (Public): Return booked timeSlot strings for serviceId and date
router.get('/appointments/booked-slots', async (req, res, next) => {
  try {
    const { serviceId, date } = req.query;

    if (!serviceId || !isValidObjectId(serviceId)) {
      return res.status(400).send({ message: 'Invalid or missing serviceId format' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).send({ message: 'date is required and must follow YYYY-MM-DD format' });
    }

    const { appointmentsCollection } = getCollections();
    const bookedAppointments = await appointmentsCollection
      .find({
        serviceId: new ObjectId(serviceId),
        appointmentDate: date,
        status: { $ne: 'cancelled' },
      })
      .project({ timeSlot: 1 })
      .toArray();

    const bookedSlots = bookedAppointments.map((appt) => appt.timeSlot);
    res.send(bookedSlots);
  } catch (error) {
    next(error);
  }
});

// GET /appointments/my (Protected: verifyJWT): Return logged-in user's appointments
router.get('/appointments/my', verifyJWT, async (req, res, next) => {
  try {
    const { appointmentsCollection } = getCollections();
    const appointments = await appointmentsCollection
      .find({ customerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(appointments);
  } catch (error) {
    next(error);
  }
});

// POST /appointments (Protected: verifyJWT, verifyCustomer): Book an appointment
router.post('/appointments', verifyJWT, verifyCustomer, async (req, res, next) => {
  try {
    const { serviceId, appointmentDate, timeSlot, notes } = req.body || {};

    if (!serviceId || !isValidObjectId(serviceId)) {
      return res.status(400).send({ message: 'serviceId is required and must be a valid ObjectId' });
    }

    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).send({ message: 'appointmentDate is required and must follow YYYY-MM-DD format' });
    }

    if (!timeSlot || typeof timeSlot !== 'string' || timeSlot.trim() === '') {
      return res.status(400).send({ message: 'timeSlot is required and must be a non-empty string' });
    }

    const { servicesCollection, appointmentsCollection } = getCollections();

    // Verify service exists and is active
    const service = await servicesCollection.findOne({ _id: new ObjectId(serviceId) });
    if (!service) {
      return res.status(404).send({ message: 'Service not found' });
    }

    if (service.status !== 'active') {
      return res.status(400).send({ message: 'Service is not currently active' });
    }

    // Double-booking check for same service, date, and time slot
    const existingBooking = await appointmentsCollection.findOne({
      serviceId: new ObjectId(serviceId),
      appointmentDate,
      timeSlot: timeSlot.trim(),
      status: { $ne: 'cancelled' },
    });

    if (existingBooking) {
      return res.status(409).send({
        message: 'This time slot is already booked for the selected date.',
      });
    }

    const newAppointment = {
      customerId: new ObjectId(req.user._id),
      customerName: req.user.name,
      customerEmail: req.user.email,
      serviceId: service._id,
      serviceName: service.serviceName,
      serviceCategory: service.category,
      serviceImage: service.image,
      price: service.price,
      duration: service.duration,
      appointmentDate,
      timeSlot: timeSlot.trim(),
      notes: notes?.trim() || '',
      status: 'pending',
      paymentStatus: 'unpaid',
      createdAt: new Date(),
    };

    const result = await appointmentsCollection.insertOne(newAppointment);
    const appointment = { _id: result.insertedId, ...newAppointment };

    res.status(201).send({
      message: 'Appointment booked successfully',
      appointment,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /appointments/:id/cancel (Protected: verifyJWT): Cancel user's pending appointment
router.patch('/appointments/:id/cancel', verifyJWT, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid appointment ID format' });
    }

    const { appointmentsCollection } = getCollections();
    const appointment = await appointmentsCollection.findOne({ _id: new ObjectId(id) });

    if (!appointment) {
      return res.status(404).send({ message: 'Appointment not found' });
    }

    if (appointment.customerEmail !== req.user.email) {
      return res.status(403).send({ message: 'Forbidden: You do not have permission to cancel this appointment' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).send({ message: 'Only pending appointments can be cancelled' });
    }

    await appointmentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'cancelled' } }
    );

    const updatedAppointment = await appointmentsCollection.findOne({ _id: new ObjectId(id) });

    res.send({
      message: 'Appointment cancelled successfully',
      appointment: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/appointments (Protected: verifyJWT, verifyAdmin): Return all appointments with optional status filter
router.get('/admin/appointments', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status && typeof status === 'string' && status.trim() !== '' && status !== 'All') {
      query.status = status.trim();
    }

    const { appointmentsCollection } = getCollections();
    const appointments = await appointmentsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(appointments);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/appointments/:id/status (Protected: verifyJWT, verifyAdmin): Update appointment status
router.patch('/admin/appointments/:id/status', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid appointment ID format' });
    }

    const { status } = req.body || {};
    const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).send({
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const { appointmentsCollection } = getCollections();
    const result = await appointmentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'Appointment not found' });
    }

    const updatedAppointment = await appointmentsCollection.findOne({ _id: new ObjectId(id) });

    res.send({
      message: 'Appointment status updated successfully',
      appointment: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
