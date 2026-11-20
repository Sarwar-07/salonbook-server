import { MongoClient, ServerApiVersion } from 'mongodb';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

let client;
let db;

const collections = {
  usersCollection: null,
  servicesCollection: null,
  appointmentsCollection: null,
  transactionsCollection: null,
};

export const connectDB = async () => {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const dbName = process.env.DB_NAME || 'salonbook_db';

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  db = client.db(dbName);

  collections.usersCollection = db.collection('users');
  collections.servicesCollection = db.collection('services');
  collections.appointmentsCollection = db.collection('appointments');
  collections.transactionsCollection = db.collection('transactions');

  // Create performance and uniqueness indexes
  await Promise.all([
    collections.usersCollection.createIndex({ email: 1 }, { unique: true }),
    collections.servicesCollection.createIndex({ category: 1, status: 1 }),
    collections.appointmentsCollection.createIndex({ serviceId: 1, appointmentDate: 1, timeSlot: 1 }),
    collections.appointmentsCollection.createIndex({ customerEmail: 1, createdAt: -1 }),
    collections.transactionsCollection.createIndex({ stripeSessionId: 1 }, { unique: true, sparse: true }),
  ]);

  console.log(`Connected to MongoDB database: ${dbName} (indexes verified)`);
  return db;
};

export const getCollections = () => {
  return collections;
};
