import express from 'express';
import { getCollections } from '../config/db.js';
import { verifyJWT, verifyAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET /dashboard/customer-stats (Protected: verifyJWT): Return stats and recent appointments for current customer
router.get('/dashboard/customer-stats', verifyJWT, async (req, res, next) => {
  try {
    const { appointmentsCollection } = getCollections();
    const customerEmail = req.user.email;

    const appointments = await appointmentsCollection
      .find({ customerEmail })
      .toArray();

    let totalAppointments = appointments.length;
    let pendingAppointments = 0;
    let confirmedAppointments = 0;
    let completedAppointments = 0;
    let totalSpent = 0;

    for (const appt of appointments) {
      if (appt.status === 'pending') pendingAppointments++;
      if (appt.status === 'confirmed') confirmedAppointments++;
      if (appt.status === 'completed') completedAppointments++;
      if (appt.paymentStatus === 'paid' && typeof appt.price === 'number') {
        totalSpent += appt.price;
      }
    }

    const recentAppointments = await appointmentsCollection
      .find({ customerEmail })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    res.send({
      stats: {
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        totalSpent,
      },
      recentAppointments,
    });
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/admin-stats (Protected: verifyJWT, verifyAdmin): Return comprehensive admin analytics
router.get('/dashboard/admin-stats', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const {
      usersCollection,
      servicesCollection,
      appointmentsCollection,
      transactionsCollection,
    } = getCollections();

    // Counts across collections
    const [totalUsers, totalServices, activeServices, totalAppointments] = await Promise.all([
      usersCollection.countDocuments(),
      servicesCollection.countDocuments(),
      servicesCollection.countDocuments({ status: 'active' }),
      appointmentsCollection.countDocuments(),
    ]);

    // Group appointments by status
    const statusAgg = await appointmentsCollection
      .aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray();

    const statusBreakdown = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const item of statusAgg) {
      if (item._id && Object.prototype.hasOwnProperty.call(statusBreakdown, item._id)) {
        statusBreakdown[item._id] = item.count;
      }
    }

    // Calculate total revenue from paid transactions
    const revenueAgg = await transactionsCollection
      .aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .toArray();

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // Aggregate category revenue from paid appointments
    let categoryRevenue = await appointmentsCollection
      .aggregate([
        { $match: { paymentStatus: 'paid' } },
        {
          $group: {
            _id: '$serviceCategory',
            revenue: { $sum: '$price' },
            bookings: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            category: { $ifNull: ['$_id', 'Other'] },
            revenue: 1,
            bookings: 1,
          },
        },
        { $sort: { revenue: -1 } },
      ])
      .toArray();

    // Fallback: check if transactionsCollection contains category revenue
    if (categoryRevenue.length === 0) {
      const txCategoryAgg = await transactionsCollection
        .aggregate([
          { $match: { status: 'paid', category: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$category',
              revenue: { $sum: '$amount' },
              bookings: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              category: { $ifNull: ['$_id', 'Other'] },
              revenue: 1,
              bookings: 1,
            },
          },
          { $sort: { revenue: -1 } },
        ])
        .toArray();

      if (txCategoryAgg.length > 0) {
        categoryRevenue = txCategoryAgg;
      }
    }

    // 5 most recent appointments & transactions
    const [recentAppointments, recentTransactions] = await Promise.all([
      appointmentsCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
      transactionsCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
    ]);

    res.send({
      stats: {
        totalUsers,
        totalServices,
        activeServices,
        totalAppointments,
        totalRevenue,
        statusBreakdown,
      },
      categoryRevenue,
      recentAppointments,
      recentTransactions,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
