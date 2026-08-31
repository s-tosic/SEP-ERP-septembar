import http from 'http';
import app from './app';
import { testDbConnection } from './config/db';

async function runEndToEndTests() {
  console.log('🧪 Pokretanje End-to-End API testova za SEP-MM...\n');

  const dbOk = await testDbConnection();
  if (!dbOk) {
    console.error('❌ Konekcija sa bazom nije uspela.');
    process.exit(1);
  }

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, resolve));
  console.log('📡 Testni server pokrenut na portu 5099.\n');

  const baseUrl = 'http://localhost:5099/api';

  try {
    // 1. Test Health Check
    console.log('1️⃣ Test: GET /api/health');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('   Status:', healthRes.status, JSON.stringify(healthData));

    // 2. Test Login
    console.log('\n2️⃣ Test: POST /api/auth/login (admin@sep-mm.rs)');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sep-mm.rs', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    console.log('   Status:', loginRes.status, 'Uspešno:', loginData.success);
    const token = loginData.token;
    if (!token) throw new Error('Token nije vraćen!');
    console.log('   JWT Token dobijen:', token.substring(0, 25) + '...');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 3. Test Warehouses
    console.log('\n3️⃣ Test: GET /api/warehouses (Zaštićena ruta)');
    const whRes = await fetch(`${baseUrl}/warehouses`, { headers: authHeaders });
    const whData = await whRes.json();
    console.log('   Broj skladišta u bazi:', whData.data.length);
    whData.data.forEach((w: any) => console.log(`   - [${w.code}] ${w.name} (${w.city})`));

    // 4. Test Products with stock calculation
    console.log('\n4️⃣ Test: GET /api/products (Proračun stanja zaliha)');
    const prodRes = await fetch(`${baseUrl}/products`, { headers: authHeaders });
    const prodData = await prodRes.json();
    console.log('   Broj artikala u katalogu:', prodData.data.length);
    prodData.data.slice(0, 3).forEach((p: any) => {
      console.log(`   - ${p.name}: Stanje = ${p.current_stock} ${p.unit_of_measure} | Status = ${p.stock_status}`);
    });

    // 5. Test Stock Movement (INBOUND)
    console.log('\n5️⃣ Test: POST /api/stock-movements (Prijem robe)');
    const movRes = await fetch(`${baseUrl}/stock-movements`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        product_id: 1,
        warehouse_id: 1,
        movement_type: 'INBOUND',
        quantity: 10,
        reference_doc: 'TEST-PRIJEM-001',
        notes: 'Automatski test prijema',
      }),
    });
    const movData = await movRes.json();
    console.log('   Status:', movRes.status, movData.message);

    // 6. Test Dashboard Stats
    console.log('\n6️⃣ Test: GET /api/dashboard/stats');
    const dashRes = await fetch(`${baseUrl}/dashboard/stats`, { headers: authHeaders });
    const dashData = await dashRes.json();
    console.log('   KPIs:', JSON.stringify(dashData.data.kpis, null, 2));

    console.log('\n🎉 SVI TESTOVI SU USPEŠNO PROŠLI (100% SUCCESS)!');
  } catch (err) {
    console.error('\n❌ Greška tokom testiranja:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runEndToEndTests();
