import assert from 'assert';
import http from 'http';
import app from './app';
import { testDbConnection } from './config/db';

async function runComprehensiveBackendTests() {
  console.log('================================================================');
  console.log('🧪 POKRETANJE TESTOVA ZA SAP MM DUAL-LEDGER ARHITEKTURU (MATDOC+MARD)');
  console.log('================================================================\n');

  // 1. Konekcija sa bazom
  const dbConnected = await testDbConnection();
  assert.strictEqual(dbConnected, true, 'Konekcija sa bazom podataka mora biti uspešna.');

  // Pokretanje testnog servera
  const server = http.createServer(app);
  const testPort = 5088;
  await new Promise<void>((resolve) => server.listen(testPort, resolve));
  const baseUrl = `http://localhost:${testPort}/api`;

  let adminToken = '';
  let magacionerToken = '';
  let createdProductId = 0;

  try {
    // ------------------------------------------------------------------------
    // TEST GRUPA 1: Health & Autentifikacija
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 1: Health Check & JWT Autentifikacija');
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.strictEqual(healthRes.status, 200);

    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sep-mm.rs', password: 'admin123' }),
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.token;

    const magLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marko@sep-mm.rs', password: 'admin123' }),
    });
    assert.strictEqual(magLoginRes.status, 200);
    const magLoginData = await magLoginRes.json();
    magacionerToken = magLoginData.token;

    console.log('   ✅ Uspešna prijava Admina i Magacionera (JWT generisan).\n');

    // ------------------------------------------------------------------------
    // TEST GRUPA 2: Kreiranje artikla i verifikacija početnog MARD stanja
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 2: Kreiranje artikla & Verifikacija početnog stanja');
    const testSku = `SAP-SKU-${Date.now()}`;
    const createProdRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sku: testSku,
        name: 'Testni Industrijski Pretvarač',
        category: 'Energetika',
        unit_of_measure: 'kom',
        unit_price: 32000.00,
        min_threshold: 10,
      }),
    });
    assert.strictEqual(createProdRes.status, 201);
    const createProdData = await createProdRes.json();
    createdProductId = createProdData.data.id;

    // Provera da je trenutno MARD stanje 0
    const getProdRes = await fetch(`${baseUrl}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getProdData = await getProdRes.json();
    assert.strictEqual(getProdData.data.current_stock, 0);
    console.log(`   ✅ Artikal ID=${createdProductId} kreiran. Početno MARD stanje je 0.\n`);

    // ------------------------------------------------------------------------
    // TEST GRUPA 3: SAP 101 Prijem (Inbound Goods Receipt)
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 3: SAP 101 Prijem robe na stanje (Inbound)');
    const inboundRes = await fetch(`${baseUrl}/stock-movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${magacionerToken}`,
      },
      body: JSON.stringify({
        product_id: createdProductId,
        warehouse_id: 1, // Beograd
        movement_type: '101_INBOUND',
        quantity: 50,
        reference_doc: 'SAP-PR-101',
        notes: 'Prijem robe od dobavljača',
      }),
    });
    assert.strictEqual(inboundRes.status, 201);
    const inboundData = await inboundRes.json();
    assert.strictEqual(inboundData.data.new_snapshot_stock, 50);

    // Provera čitanja iz MARD tabele
    const checkAfter101 = await fetch(`${baseUrl}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfter101 = await checkAfter101.json();
    assert.strictEqual(stockAfter101.data.current_stock, 50, 'MARD Snapshot mora odmah biti 50');
    console.log('   ✅ SAP 101 Prijem: Ledger upisan + MARD Snapshot ažuriran na 50 kom.\n');

    // ------------------------------------------------------------------------
    // TEST GRUPA 4: SAP 201 Izdavanje & Zaštita od negativnog stanja
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 4: SAP 201 Izdavanje robe (Outbound Issue)');

    // 4.1 Negativni test: Pokušaj izdavanja više nego što imamo (npr. 80 komada)
    const badOutboundRes = await fetch(`${baseUrl}/stock-movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${magacionerToken}`,
      },
      body: JSON.stringify({
        product_id: createdProductId,
        warehouse_id: 1,
        movement_type: '201_OUTBOUND',
        quantity: 80,
        reference_doc: 'FAIL-201',
        notes: 'Mora biti odbijeno',
      }),
    });
    assert.strictEqual(badOutboundRes.status, 400, 'Mora vratiti 400 Bad Request');
    console.log('   ✅ Sprečeno izdavanje preko raspoloživih zaliha (400 Bad Request).');

    // 4.2 Validno izdavanje od 30 komada
    const validOutboundRes = await fetch(`${baseUrl}/stock-movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${magacionerToken}`,
      },
      body: JSON.stringify({
        product_id: createdProductId,
        warehouse_id: 1,
        movement_type: '201_OUTBOUND',
        quantity: 30,
        reference_doc: 'SAP-OTP-201',
        notes: 'Izdavanje za kupca',
      }),
    });
    assert.strictEqual(validOutboundRes.status, 201);

    // Provera da je stanje sada 50 - 30 = 20
    const checkAfter201 = await fetch(`${baseUrl}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfter201 = await checkAfter201.json();
    assert.strictEqual(stockAfter201.data.current_stock, 20);
    console.log('   ✅ SAP 201 Izdavanje: 30 komada izdato. MARD Snapshot stanje: 20 kom.\n');

    // ------------------------------------------------------------------------
    // TEST GRUPA 5: SAP 301 Međuskladišni prenos (Warehouse Transfer)
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 5: SAP 301 Međuskladišni prenos (Beograd -> Niš)');
    const transferRes = await fetch(`${baseUrl}/stock-movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${magacionerToken}`,
      },
      body: JSON.stringify({
        product_id: createdProductId,
        warehouse_id: 1, // Beograd (polazno)
        target_warehouse_id: 2, // Niš (odredišno)
        movement_type: '301_TRANSFER',
        quantity: 5,
        reference_doc: 'SAP-TR-301',
        notes: 'Dopuna zaliha za južni region',
      }),
    });
    assert.strictEqual(transferRes.status, 201);

    // Provera raspodele po skladištima
    const checkAfter301 = await fetch(`${baseUrl}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfter301 = await checkAfter301.json();
    assert.strictEqual(stockAfter301.data.current_stock, 20, 'Ukupno stanje mora ostati 20');
    
    const bgStock = stockAfter301.data.warehouse_breakdown.find((w: any) => w.warehouse_id === 1);
    const niStock = stockAfter301.data.warehouse_breakdown.find((w: any) => w.warehouse_id === 2);
    assert.strictEqual(bgStock.stock_in_warehouse, 15, 'Beograd stanje mora biti 15');
    assert.strictEqual(niStock.stock_in_warehouse, 5, 'Niš stanje mora biti 5');
    console.log('   ✅ SAP 301 Prenos: 5 komada preneto iz Beograda u Niš. Stanja tačno ažurirana (BG: 15, NI: 5).\n');

    // ------------------------------------------------------------------------
    // TEST GRUPA 6: SAP 551 Rashodovanje / Otpis (Scrapping)
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 6: SAP 551 Rashod / Otpis oštećene robe');
    const scrapRes = await fetch(`${baseUrl}/stock-movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${magacionerToken}`,
      },
      body: JSON.stringify({
        product_id: createdProductId,
        warehouse_id: 1,
        movement_type: '551_SCRAP',
        quantity: 11, // Beograd 15 - 11 = 4 (Ukupno 4 + 5 = 9 < min_threshold=10 -> KRITIČNO)
        reference_doc: 'SAP-RASH-551',
        notes: 'Oštećeno u skladištu Beograd',
      }),
    });
    assert.strictEqual(scrapRes.status, 201);

    const checkAfter551 = await fetch(`${baseUrl}/products/${createdProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stockAfter551 = await checkAfter551.json();
    assert.strictEqual(stockAfter551.data.current_stock, 9);
    assert.strictEqual(stockAfter551.data.stock_status, 'KRITIČNO');
    console.log('   ✅ SAP 551 Otpis: 11 komada rashodovano. Preostalo 9 komada (Status: KRITIČNO).\n');

    // ------------------------------------------------------------------------
    // TEST GRUPA 7: Periodična Rekoncilijacija (Usaglašavanje MATDOC == MARD)
    // ------------------------------------------------------------------------
    console.log('🔹 GRUPA 7: Integritet podataka & Reconciliation Provera (MATDOC vs MARD)');
    const reconcileRes = await fetch(`${baseUrl}/stock-movements/reconcile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(reconcileRes.status, 200);
    const reconcileData = await reconcileRes.json();
    assert.strictEqual(reconcileData.data.is_healthy, true, 'Sve zalihe moraju biti 100% usaglašene');
    assert.strictEqual(reconcileData.data.total_discrepancies, 0, 'Broj odstupanja mora biti tačno 0');
    console.log(`   ✅ Reconciliation provera:`);
    console.log(`      - Provereno zapisa: ${reconcileData.data.total_records_checked}`);
    console.log(`      - Broj odstupanja (Discrepancies): ${reconcileData.data.total_discrepancies}`);
    console.log(`      - Status integriteta: 100% USAGLAŠENO (HEALTHY)`);

    // Brisanje testnog artikla
    await fetch(`${baseUrl}/products/${createdProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('   ✅ Očišćeni testni podaci.');

    console.log('\n================================================================');
    console.log('🏆 SVI TESTOVI ZA DUAL-LEDGER ARHITEKTURU SU 100% USPEŠNI!');
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n❌ TEST JE PAO:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

runComprehensiveBackendTests();
