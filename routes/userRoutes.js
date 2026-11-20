import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyJWT, verifyAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ObjectId validation helper
const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
};

// PATCH /users/profile (Protected: verifyJWT): Update customer profile
router.patch('/users/profile', verifyJWT, async (req, res, next) => {
  try {
    const { name, phone, image } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).send({ message: 'name must be a non-empty string' });
      }
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return res.status(400).send({ message: 'phone must be a string' });
      }
      updates.phone = phone.trim();
    }

    if (image !== undefined) {
      if (typeof image !== 'string' || image.trim() === '') {
        return res.status(400).send({ message: 'image must be a non-empty string URL' });
      }
      updates.image = image.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'No valid update fields provided' });
    }

    const { usersCollection } = getCollections();
    const result = await usersCollection.updateOne(
      { email: req.user.email },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'User not found' });
    }

    const updatedUser = await usersCollection.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    res.send({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/users (Protected: verifyJWT, verifyAdmin): Fetch all users excluding passwords
router.get('/admin/users', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { usersCollection } = getCollections();
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(users);
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/users/:id/role (Protected: verifyJWT, verifyAdmin): Update user role
router.patch('/admin/users/:id/role', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid user ID format' });
    }

    if (String(req.user._id) === String(id)) {
      return res.status(400).send({ message: 'You cannot change your own admin role.' });
    }

    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'customer') {
      return res.status(400).send({ message: "role must be either 'admin' or 'customer'" });
    }

    const { usersCollection } = getCollections();
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'User not found' });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );

    res.send({
      message: 'User role updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /admin/users/:id/block (Protected: verifyJWT, verifyAdmin): Update user block status
router.patch('/admin/users/:id/block', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid user ID format' });
    }

    if (String(req.user._id) === String(id)) {
      return res.status(400).send({ message: 'You cannot block your own account.' });
    }

    const { isBlocked } = req.body || {};
    if (typeof isBlocked !== 'boolean') {
      return res.status(400).send({ message: 'isBlocked must be a boolean' });
    }

    const { usersCollection } = getCollections();
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isBlocked } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'User not found' });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );

    res.send({
      message: 'User block status updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
