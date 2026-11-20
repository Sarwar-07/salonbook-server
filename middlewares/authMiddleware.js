import jwt from 'jsonwebtoken';
import { getCollections } from '../config/db.js';

export const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).send({ message: 'Unauthorized access: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).send({ message: 'Unauthorized access: Token missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send({ message: 'Unauthorized access: Invalid or expired token' });
    }

    if (!decoded || !decoded.email) {
      return res.status(401).send({ message: 'Unauthorized access: Invalid token payload' });
    }

    const { usersCollection } = getCollections();
    if (!usersCollection) {
      return res.status(500).send({ message: 'Database collection unavailable' });
    }

    const user = await usersCollection.findOne({ email: decoded.email });
    if (!user) {
      return res.status(401).send({ message: 'Unauthorized access: User not found' });
    }

    if (user.isBlocked) {
      return res.status(403).send({ message: 'Forbidden access: User is blocked' });
    }

    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      phone: user.phone,
      role: user.role,
      isBlocked: user.isBlocked ?? false,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access: Admin only' });
  }
  next();
};

export const verifyCustomer = (req, res, next) => {
  if (req.user?.role !== 'customer') {
    return res.status(403).send({ message: 'Forbidden access: Customer only' });
  }
  next();
};
