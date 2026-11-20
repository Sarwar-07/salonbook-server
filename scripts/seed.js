import 'dotenv/config';
import { connectDB, getCollections } from '../config/db.js';

const demoUsers = [
  {
    name: 'Aria Montgomery (Admin)',
    email: 'admin@salonbook.com',
    role: 'admin',
    isBlocked: false,
    phone: '+1 (555) 234-5678',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
    createdAt: new Date(),
  },
  {
    name: 'Sophia Laurent',
    email: 'customer@salonbook.com',
    role: 'customer',
    isBlocked: false,
    phone: '+1 (555) 876-5432',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    createdAt: new Date(),
  },
];

const demoServices = [
  {
    serviceName: 'Signature Blowout & Styling',
    category: 'Hair',
    description: 'Professional hair wash with premium botanical shampoo, customized blowout, and signature thermal styling.',
    price: 55,
    duration: 45,
    image: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Precision Cut & Conditioning Treatment',
    category: 'Hair',
    description: 'Custom haircut tailored to facial structure paired with a deep reconstructive keratin treatment.',
    price: 85,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Full Balayage & Glaze Finish',
    category: 'Hair',
    description: 'Hand-painted sun-kissed lightening technique finished with an ultra-gloss shine glaze and toner.',
    price: 175,
    duration: 120,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'HydraGlow Deep Cleanse Facial',
    category: 'Skin',
    description: 'Multi-step vortex suction cleansing, ultrasonic exfoliation, and intense hyaluronic acid hydration infusion.',
    price: 125,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Anti-Aging Collagen Boost Therapy',
    category: 'Skin',
    description: 'Targeted LED light rejuvenation therapy combined with bio-cellulose marine collagen mask and lifting massage.',
    price: 145,
    duration: 75,
    image: 'https://images.unsplash.com/photo-1512290900672-1f02e70e9a59?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Deluxe Gel Spa Manicure',
    category: 'Nails',
    description: 'Organic botanical cuticle therapy, hand scrub, relaxing acupressure massage, and long-lasting gel polish.',
    price: 48,
    duration: 45,
    image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Aromatherapy Reflexology Pedicure',
    category: 'Nails',
    description: 'Warm herbal foot soak, dead sea salt exfoliation, hot towel wrap, reflexology massage, and polish.',
    price: 65,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Aromatherapy Swedish Full Body Massage',
    category: 'Spa',
    description: 'Full-body relaxation therapy using warm cold-pressed organic sweet almond oil and therapeutic lavender essence.',
    price: 110,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Himalayan Hot Stone Deep Tissue Massage',
    category: 'Spa',
    description: 'Heated smooth basalt stones combined with deep muscular pressure to release chronic tension and stress.',
    price: 140,
    duration: 90,
    image: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Detoxifying Body Wrap & Polish',
    category: 'Spa',
    description: 'Invigorating raw cane sugar scrub followed by mineral-rich French green clay thermal cocoon wrap.',
    price: 130,
    duration: 75,
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Glamour Evening & Event Makeup',
    category: 'Makeup',
    description: 'HD camera-ready makeup application complete with contouring, eye enhancement, and premium faux mink lashes.',
    price: 95,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
  {
    serviceName: 'Bridal Couture Makeup Trial & Consultation',
    category: 'Makeup',
    description: 'Comprehensive bridal beauty session with custom color palette analysis, airbrush base, and veil styling trial.',
    price: 160,
    duration: 90,
    image: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
    status: 'active',
    createdAt: new Date(),
  },
];

const seed = async () => {
  try {
    console.log('Connecting to MongoDB for seeding...');
    await connectDB();
    const { usersCollection, servicesCollection } = getCollections();

    console.log('Seeding demo users...');
    let seededUsersCount = 0;
    for (const user of demoUsers) {
      await usersCollection.updateOne(
        { email: user.email },
        { $set: user },
        { upsert: true }
      );
      seededUsersCount++;
    }
    console.log(`Successfully seeded ${seededUsersCount} demo users.`);

    console.log('Seeding salon services...');
    let seededServicesCount = 0;
    for (const service of demoServices) {
      await servicesCollection.updateOne(
        { serviceName: service.serviceName },
        { $set: service },
        { upsert: true }
      );
      seededServicesCount++;
    }
    console.log(`Successfully seeded ${seededServicesCount} salon services across 5 categories.`);

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during database seeding:', error);
    process.exit(1);
  }
};

seed();
