import { MongoClient, ServerApiVersion } from 'mongodb';
import dns from 'node:dns';

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}

let client;
let db = global._mongoDbInstance || null;

const collections = {
  usersCollection: null,
  servicesCollection: null,
  appointmentsCollection: null,
  transactionsCollection: null,
};

export const getDB = () => db || global._mongoDbInstance || null;

export const connectDB = async () => {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const dbName = process.env.DB_NAME || 'salonbook_db';

  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    global._mongoClientPromise = client.connect();
  }

  client = await global._mongoClientPromise;
  db = client.db(dbName);
  global._mongoDbInstance = db;

  collections.usersCollection = db.collection('users');
  collections.servicesCollection = db.collection('services');
  collections.appointmentsCollection = db.collection('appointments');
  collections.transactionsCollection = db.collection('transactions');

  // Create performance and uniqueness indexes once per runtime instance
  if (!global._mongoIndexesCreated) {
    global._mongoIndexesCreated = true;
    try {
      await Promise.all([
        collections.usersCollection.createIndex({ email: 1 }, { unique: true }),
        collections.servicesCollection.createIndex({ category: 1, status: 1 }),
        collections.appointmentsCollection.createIndex({ serviceId: 1, appointmentDate: 1, timeSlot: 1 }),
        collections.appointmentsCollection.createIndex({ customerEmail: 1, createdAt: -1 }),
        collections.transactionsCollection.createIndex({ stripeSessionId: 1 }, { unique: true, sparse: true }),
      ]);
    } catch (idxErr) {
      console.warn('Index verification warning:', idxErr.message);
    }
  }

  return db;
};

export const getCollections = () => {
  const currentDb = getDB();
  if (currentDb) {
    collections.usersCollection = currentDb.collection('users');
    collections.servicesCollection = currentDb.collection('services');
    collections.appointmentsCollection = currentDb.collection('appointments');
    collections.transactionsCollection = currentDb.collection('transactions');
  }
  return collections;
};
