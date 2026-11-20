import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDB, getCollections } from '../config/db.js';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

async function run() {
  console.log(`Starting API verification against ${BASE_URL}...\n`);

  // 1. GET / returns 200 with status: 'ok'
  const res1 = await fetch(`${BASE_URL}/`);
  if (res1.status !== 200) throw new Error(`Test 1 Failed: Expected status 200, got ${res1.status}`);
  const data1 = await res1.json();
  if (data1.status !== 'ok') throw new Error(`Test 1 Failed: Expected status: 'ok', got ${data1.status}`);
  console.log('[PASS] 1. GET / returns 200 with status: ok');

  // 2. GET /api/services returns 200 and a non-empty array of active services
  const res2 = await fetch(`${BASE_URL}/api/services`);
  if (res2.status !== 200) throw new Error(`Test 2 Failed: Expected status 200, got ${res2.status}`);
  const data2 = await res2.json();
  if (!Array.isArray(data2) || data2.length === 0) throw new Error('Test 2 Failed: Expected non-empty array of services');
  if (data2.some((s) => s.status !== 'active')) throw new Error('Test 2 Failed: Non-active service found in public services');
  console.log(`[PASS] 2. GET /api/services returns 200 with ${data2.length} active services`);

  // 3. GET /api/services?category=Hair&sort=price_asc returns 200 with filtered results
  const res3 = await fetch(`${BASE_URL}/api/services?category=Hair&sort=price_asc`);
  if (res3.status !== 200) throw new Error(`Test 3 Failed: Expected status 200, got ${res3.status}`);
  const data3 = await res3.json();
  if (!Array.isArray(data3) || data3.length === 0) throw new Error('Test 3 Failed: Expected non-empty array for Hair category');
  if (data3.some((s) => s.category !== 'Hair')) throw new Error('Test 3 Failed: Non-Hair category returned');
  for (let i = 0; i < data3.length - 1; i++) {
    if (data3[i].price > data3[i + 1].price) throw new Error('Test 3 Failed: Results not sorted by price_asc');
  }
  console.log(`[PASS] 3. GET /api/services?category=Hair&sort=price_asc returns 200 with filtered and sorted results (${data3.length} items)`);

  // 4. POST /api/auth/jwt for admin -> adminToken and role: 'admin'
  const res4 = await fetch(`${BASE_URL}/api/auth/jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@salonbook.com', name: 'Aria Montgomery (Admin)' }),
  });
  if (res4.status !== 200) throw new Error(`Test 4 Failed: Expected status 200, got ${res4.status}`);
  const data4 = await res4.json();
  if (!data4.token || data4.user?.role !== 'admin') throw new Error(`Test 4 Failed: Expected admin token and role: 'admin'`);
  const adminToken = data4.token;
  console.log('[PASS] 4. POST /api/auth/jwt for admin returns 200 with role: admin and adminToken');

  // 5. POST /api/auth/jwt for customer -> customerToken and role: 'customer'
  const res5 = await fetch(`${BASE_URL}/api/auth/jwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@salonbook.com', name: 'Sophia Laurent' }),
  });
  if (res5.status !== 200) throw new Error(`Test 5 Failed: Expected status 200, got ${res5.status}`);
  const data5 = await res5.json();
  if (!data5.token || data5.user?.role !== 'customer') throw new Error(`Test 5 Failed: Expected customer token and role: 'customer'`);
  const customerToken = data5.token;
  console.log('[PASS] 5. POST /api/auth/jwt for customer returns 200 with role: customer and customerToken');

  // 6. Role protection check: POST /api/services using customerToken returns 403 Forbidden
  const res6 = await fetch(`${BASE_URL}/api/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      serviceName: 'Unauthorized Customer Service Attempt',
      category: 'Hair',
      description: 'Should be rejected with 403',
      image: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800',
      price: 50,
      duration: 30,
    }),
  });
  if (res6.status !== 403) throw new Error(`Test 6 Failed: Expected status 403 Forbidden, got ${res6.status}`);
  console.log('[PASS] 6. Role protection check: POST /api/services using customerToken returns 403 Forbidden');

  // 7. Admin CRUD check: POST /api/services creates temporary test service (201 Created)
  const tempServiceName = `Temp Verification Service ${Date.now()}`;
  const res7 = await fetch(`${BASE_URL}/api/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      serviceName: tempServiceName,
      category: 'Spa',
      description: 'Automated verification test service',
      image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
      price: 99,
      duration: 60,
    }),
  });
  if (res7.status !== 201) throw new Error(`Test 7 Failed: Expected status 201 Created, got ${res7.status}`);
  const data7 = await res7.json();
  const createdServiceId = data7.service?._id;
  if (!createdServiceId) throw new Error('Test 7 Failed: Service _id not returned in created service');
  console.log(`[PASS] 7. Admin CRUD check: POST /api/services using adminToken creates temporary test service (201 Created, ID: ${createdServiceId})`);

  let createdAppointmentId = null;
  try {
    // 8. Booking & conflict check
    // 8a. POST /api/appointments using customerToken -> 201 Created
    const res8a = await fetch(`${BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        serviceId: createdServiceId,
        appointmentDate: '2026-12-25',
        timeSlot: '10:00 AM',
        notes: 'Verification test booking',
      }),
    });
    if (res8a.status !== 201) throw new Error(`Test 8a Failed: Expected status 201 Created, got ${res8a.status}`);
    const data8a = await res8a.json();
    createdAppointmentId = data8a.appointment?._id;
    console.log('[PASS] 8a. Booking check: POST /api/appointments using customerToken returns 201 Created');

    // 8b. Repeating the exact same request returns 409 Conflict
    const res8b = await fetch(`${BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        serviceId: createdServiceId,
        appointmentDate: '2026-12-25',
        timeSlot: '10:00 AM',
        notes: 'Verification duplicate booking attempt',
      }),
    });
    if (res8b.status !== 409) throw new Error(`Test 8b Failed: Expected status 409 Conflict, got ${res8b.status}`);
    console.log('[PASS] 8b. Conflict check: Repeating exact same booking returns 409 Conflict (double-booking prevented)');

    // 9. Dashboard stats check: GET /api/dashboard/admin-stats with adminToken returns 200
    const res9 = await fetch(`${BASE_URL}/api/dashboard/admin-stats`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    if (res9.status !== 200) throw new Error(`Test 9 Failed: Expected status 200, got ${res9.status}`);
    const data9 = await res9.json();
    if (typeof data9.stats?.totalServices !== 'number' || typeof data9.stats?.totalUsers !== 'number') {
      throw new Error('Test 9 Failed: stats.totalServices or stats.totalUsers missing in response');
    }
    console.log(`[PASS] 9. Dashboard stats check: GET /api/dashboard/admin-stats returns 200 (Total Services: ${data9.stats.totalServices}, Total Users: ${data9.stats.totalUsers})`);
  } finally {
    // 10. Cleanup: Remove temporary appointment and delete temporary test service
    console.log('Cleaning up temporary verification artifacts...');
    await connectDB();
    const { appointmentsCollection } = getCollections();
    if (createdAppointmentId) {
      await appointmentsCollection.deleteOne({ _id: new ObjectId(createdAppointmentId) });
    }
    await appointmentsCollection.deleteMany({ serviceId: new ObjectId(createdServiceId) });

    const res10 = await fetch(`${BASE_URL}/api/services/${createdServiceId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    if (res10.status !== 200) throw new Error(`Test 10 Failed: Expected DELETE status 200, got ${res10.status}`);
    console.log('[PASS] 10. Cleanup: Temporary test service and appointments deleted cleanly (200 OK)');
  }

  console.log('\nAll API verification checks passed!');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n[FAIL] API Verification failed:', err.message || err);
  process.exit(1);
});
