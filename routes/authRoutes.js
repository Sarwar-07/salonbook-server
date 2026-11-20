import express from 'express';
import jwt from 'jsonwebtoken';
import { getCollections } from '../config/db.js';

const router = express.Router();

// POST /auth/jwt (Public): Authenticate or sync user and issue JWT
router.post('/auth/jwt', async (req, res, next) => {
  try {
    const { email, name, image } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).send({ message: 'A valid email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { usersCollection } = getCollections();

    let user = await usersCollection.findOne({ email: normalizedEmail });

    if (!user) {
      const defaultName = name && typeof name === 'string' && name.trim() !== ''
        ? name.trim()
        : normalizedEmail.split('@')[0];

      const newUserDoc = {
        name: defaultName,
        email: normalizedEmail,
        image: (image && typeof image === 'string') ? image.trim() : '',
        phone: '',
        role: 'customer',
        isBlocked: false,
        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(newUserDoc);
      user = { _id: result.insertedId, ...newUserDoc };
    } else {
      // If user already exists, optionally backfill name or image if currently empty
      const updates = {};
      if ((!user.name || user.name.trim() === '') && name && typeof name === 'string' && name.trim() !== '') {
        updates.name = name.trim();
        user.name = updates.name;
      }
      if ((!user.image || user.image.trim() === '') && image && typeof image === 'string' && image.trim() !== '') {
        updates.image = image.trim();
        user.image = updates.image;
      }

      if (Object.keys(updates).length > 0) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: updates }
        );
      }
    }

    if (user.isBlocked) {
      return res.status(403).send({ message: 'Your account has been suspended by an administrator.' });
    }

    const token = jwt.sign(
      {
        _id: user._id.toString(),
        email: user.email,
        role: user.role || 'customer',
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).send({
      token,
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image || '',
        phone: user.phone || '',
        role: user.role || 'customer',
        isBlocked: Boolean(user.isBlocked),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
