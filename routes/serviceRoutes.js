import express from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../config/db.js';
import { verifyJWT, verifyAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ObjectId validation helper
const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
};

// GET /services (Public): Query only active services with search, category, sort, limit
router.get('/services', async (req, res, next) => {
  try {
    const { servicesCollection } = getCollections();
    const { search, category, sort, limit } = req.query;

    const query = { status: 'active' };

    if (search && typeof search === 'string' && search.trim() !== '') {
      query.serviceName = { $regex: search.trim(), $options: 'i' };
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOption = { price: -1 };
    }

    let cursor = servicesCollection.find(query).sort(sortOption);

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        cursor = cursor.limit(parsedLimit);
      }
    }

    const services = await cursor.toArray();
    res.send(services);
  } catch (error) {
    next(error);
  }
});

// GET /admin/services (Protected: verifyJWT, verifyAdmin): Return all services sorted by createdAt desc
router.get('/admin/services', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { servicesCollection } = getCollections();
    const services = await servicesCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(services);
  } catch (error) {
    next(error);
  }
});

// GET /services/:id (Public): Fetch a single service by ObjectId
router.get('/services/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid service ID format' });
    }

    const { servicesCollection } = getCollections();
    const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
    if (!service) {
      return res.status(404).send({ message: 'Service not found' });
    }

    res.send(service);
  } catch (error) {
    next(error);
  }
});

// POST /services (Protected: verifyJWT, verifyAdmin): Create a new salon service
router.post('/services', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { serviceName, category, description, image, price, duration, status } = req.body || {};

    if (!serviceName || typeof serviceName !== 'string' || serviceName.trim() === '') {
      return res.status(400).send({ message: 'serviceName is required and must be a non-empty string' });
    }

    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).send({ message: 'category is required and must be a non-empty string' });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).send({ message: 'description is required and must be a non-empty string' });
    }

    if (!image || typeof image !== 'string' || image.trim() === '') {
      return res.status(400).send({ message: 'image is required and must be a non-empty string' });
    }

    const numPrice = Number(price);
    if (price === undefined || price === null || isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).send({ message: 'price is required and must be a positive number' });
    }

    const numDuration = Number(duration);
    if (duration === undefined || duration === null || isNaN(numDuration) || numDuration <= 0) {
      return res.status(400).send({ message: 'duration is required and must be a positive number' });
    }

    const serviceStatus = status === 'inactive' ? 'inactive' : 'active';

    const newService = {
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      image: image.trim(),
      price: numPrice,
      duration: numDuration,
      status: serviceStatus,
      createdAt: new Date(),
    };

    const { servicesCollection } = getCollections();
    const result = await servicesCollection.insertOne(newService);
    const createdService = { _id: result.insertedId, ...newService };

    res.status(201).send({
      message: 'Service created successfully',
      service: createdService,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /services/:id (Protected: verifyJWT, verifyAdmin): Update service fields
router.patch('/services/:id', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid service ID format' });
    }

    const { serviceName, category, description, image, price, duration, status } = req.body || {};
    const updates = {};

    if (serviceName !== undefined) {
      if (typeof serviceName !== 'string' || serviceName.trim() === '') {
        return res.status(400).send({ message: 'serviceName must be a non-empty string' });
      }
      updates.serviceName = serviceName.trim();
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || category.trim() === '') {
        return res.status(400).send({ message: 'category must be a non-empty string' });
      }
      updates.category = category.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim() === '') {
        return res.status(400).send({ message: 'description must be a non-empty string' });
      }
      updates.description = description.trim();
    }

    if (image !== undefined) {
      if (typeof image !== 'string' || image.trim() === '') {
        return res.status(400).send({ message: 'image must be a non-empty string' });
      }
      updates.image = image.trim();
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).send({ message: 'price must be a positive number' });
      }
      updates.price = numPrice;
    }

    if (duration !== undefined) {
      const numDuration = Number(duration);
      if (isNaN(numDuration) || numDuration <= 0) {
        return res.status(400).send({ message: 'duration must be a positive number' });
      }
      updates.duration = numDuration;
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).send({ message: "status must be either 'active' or 'inactive'" });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'No valid update fields provided' });
    }

    const { servicesCollection } = getCollections();
    const result = await servicesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: 'Service not found' });
    }

    const updatedService = await servicesCollection.findOne({ _id: new ObjectId(id) });

    res.send({
      message: 'Service updated successfully',
      service: updatedService,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /services/:id (Protected: verifyJWT, verifyAdmin): Delete service by ObjectId
router.delete('/services/:id', verifyJWT, verifyAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).send({ message: 'Invalid service ID format' });
    }

    const { servicesCollection } = getCollections();
    const result = await servicesCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: 'Service not found' });
    }

    res.send({ message: 'Service deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
