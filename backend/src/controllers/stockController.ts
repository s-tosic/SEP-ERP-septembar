import { Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { AuthRequest, MovementType, ReconciliationItem, ReconciliationReport } from '../types';

export async function getAllMovements(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { warehouse_id, product_id, type } = req.query;

    let query = `
      SELECT 
        sm.id,
        sm.product_id,
        sm.warehouse_id,
        sm.user_id,
        sm.movement_type,
        sm.quantity,
        sm.reference_doc,
        sm.notes,
        sm.movement_date,
        p.sku AS product_sku,
        p.name AS product_name,
        p.unit_of_measure,
        w.code AS warehouse_code,
        w.name AS warehouse_name,
        w.city AS warehouse_city,
        u.name AS user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      JOIN users u ON sm.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (warehouse_id) {
      query += ' AND sm.warehouse_id = ?';
      params.push(warehouse_id);
    }

    if (product_id) {
      query += ' AND sm.product_id = ?';
      params.push(product_id);
    }

    if (type) {
      query += ' AND sm.movement_type = ?';
      params.push(type);
    }

    query += ' ORDER BY sm.movement_date DESC, sm.id DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('Greška pri dohvatanju promena zaliha:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri dohvatanju promena zaliha.' });
  }
}

/**
 * Knjiženje promene u atomskoj transakciji (SAP MM Dual Ledger + Snapshot Pattern)
 * Podržava:
 * - SAP 101: Prijem robe od dobavljača (+Qty)
 * - SAP 201: Izdavanje robe za nalog (-Qty)
 * - SAP 551: Rashod / Otpis oštećene robe (-Qty)
 * - SAP 301: Međuskladišni prenos (Transfer između 2 skladišne lokacije)
 */
export async function createMovement(req: AuthRequest, res: Response): Promise<void> {
  const connection = await pool.getConnection();

  try {
    const {
      product_id,
      warehouse_id,
      target_warehouse_id,
      movement_type,
      quantity,
      reference_doc,
      notes,
    } = req.body;

    if (!product_id || !warehouse_id || !movement_type || !quantity) {
      res.status(400).json({
        success: false,
        message: 'Molimo popunite obavezna polja (artikal, skladište, tip promene, količina).',
      });
      return;
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      res.status(400).json({
        success: false,
        message: 'Količina mora biti pozitivan broj veći od 0.',
      });
      return;
    }

    const userId = req.user?.id || 1;

    // Pokretanje atomske transakcije
    await connection.beginTransaction();

    // 1. Provera artikla
    const [products] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, sku, unit_of_measure FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Izabrani artikal ne postoji.' });
      return;
    }

    // 2. Provera polaznog skladišta
    const [sourceWh] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, city, is_active FROM warehouses WHERE id = ?',
      [warehouse_id]
    );

    if (sourceWh.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Izabrano skladište ne postoji.' });
      return;
    }

    if (!sourceWh[0].is_active) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Izabrano skladište je trenutno neaktivno.' });
      return;
    }

    // =========================================================================
    // SLUČAJ A: SAP 301 - Međuskladišni prenos (Transfer)
    // =========================================================================
    if (movement_type === '301_TRANSFER') {
      if (!target_warehouse_id) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: 'Za međuskladišni prenos (SAP 301) morate izabrati odredišno skladište.',
        });
        return;
      }

      if (Number(warehouse_id) === Number(target_warehouse_id)) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: 'Polazno i odredišno skladište moraju biti različite lokacije.',
        });
        return;
      }

      const [targetWh] = await connection.query<RowDataPacket[]>(
        'SELECT id, name, city, is_active FROM warehouses WHERE id = ?',
        [target_warehouse_id]
      );

      if (targetWh.length === 0 || !targetWh[0].is_active) {
        await connection.rollback();
        res.status(400).json({ success: false, message: 'Odredišno skladište ne postoji ili je neaktivno.' });
        return;
      }

      // Zaključavanje stanja na polaznom skladištu
      const [sourceStock] = await connection.query<RowDataPacket[]>(
        'SELECT quantity FROM current_stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
        [product_id, warehouse_id]
      );

      const availableSourceQty = sourceStock.length > 0 ? Number(sourceStock[0].quantity) : 0;
      if (availableSourceQty < qty) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: `Nedovoljno stanje na skladištu "${sourceWh[0].name}" (${sourceWh[0].city}). Raspoloživo: ${availableSourceQty}, Traženo: ${qty}.`,
        });
        return;
      }

      const docRef = reference_doc ? reference_doc.trim() : `TR-${Date.now().toString().slice(-6)}`;
      const noteText = notes ? notes.trim() : '';

      // 1. Upis izlaza u Ledger za polazno skladište
      const sourceNote = `Prenos na lokaciju: ${targetWh[0].name} (${targetWh[0].city})${noteText ? ' | ' + noteText : ''}`;
      await connection.query(
        'INSERT INTO stock_movements (product_id, warehouse_id, user_id, movement_type, quantity, reference_doc, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [product_id, warehouse_id, userId, '301_TRANSFER_OUT', qty, docRef, sourceNote]
      );

      // 2. Upis ulaza u Ledger za odredišno skladište
      const targetNote = `Prijem sa lokacije: ${sourceWh[0].name} (${sourceWh[0].city})${noteText ? ' | ' + noteText : ''}`;
      await connection.query(
        'INSERT INTO stock_movements (product_id, warehouse_id, user_id, movement_type, quantity, reference_doc, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [product_id, target_warehouse_id, userId, '301_TRANSFER_IN', qty, docRef, targetNote]
      );

      // 3. Oduzimanje sa Snapshot-a polaznog skladišta
      await connection.query(
        'UPDATE current_stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?',
        [qty, product_id, warehouse_id]
      );

      // 4. Dodavanje na Snapshot odredišnog skladišta
      await connection.query(
        `INSERT INTO current_stock (product_id, warehouse_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [product_id, target_warehouse_id, qty, qty]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: `Uspešno izvršen prenos ${qty} ${products[0].unit_of_measure} sa lokacije "${sourceWh[0].city}" na lokaciju "${targetWh[0].city}" (SAP 301).`,
        data: {
          movement_type: '301_TRANSFER',
          product_id,
          source_warehouse_id: warehouse_id,
          target_warehouse_id,
          quantity: qty,
        },
      });
      return;
    }

    // =========================================================================
    // SLUČAJ B: Standardna knjiženja (101 Ulaz, 201 Izlaz, 551 Otpis)
    // =========================================================================
    let normalizedType: MovementType = movement_type;
    let isAddition = true;

    if (movement_type === '101_INBOUND' || movement_type === 'INBOUND') {
      normalizedType = '101_INBOUND';
      isAddition = true;
    } else if (movement_type === '201_OUTBOUND' || movement_type === 'OUTBOUND') {
      normalizedType = '201_OUTBOUND';
      isAddition = false;
    } else if (movement_type === '551_SCRAP') {
      normalizedType = '551_SCRAP';
      isAddition = false;
    } else {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Nevažeći tip kretanja. Dozvoljeni: 101_INBOUND, 201_OUTBOUND, 551_SCRAP, 301_TRANSFER.',
      });
      return;
    }

    // Zaključavanje reda u Snapshot tabeli
    const [stockSnapshot] = await connection.query<RowDataPacket[]>(
      'SELECT quantity FROM current_stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
      [product_id, warehouse_id]
    );

    const currentQtyInStock = stockSnapshot.length > 0 ? Number(stockSnapshot[0].quantity) : 0;

    // Provera raspoloživosti za izlaze
    if (!isAddition && currentQtyInStock < qty) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: `Nedovoljno stanje na skladištu. Raspoloživo: ${currentQtyInStock}, Traženo: ${qty}.`,
      });
      return;
    }

    // Upis u Ledger (MATDOC)
    const [insertResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO stock_movements (product_id, warehouse_id, user_id, movement_type, quantity, reference_doc, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id, warehouse_id, userId, normalizedType, qty, reference_doc || null, notes || null]
    );

    // Ažuriranje Snapshot-a (MARD)
    const delta = isAddition ? qty : -qty;
    await connection.query(
      `INSERT INTO current_stock (product_id, warehouse_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [product_id, warehouse_id, delta, delta]
    );

    await connection.commit();

    let successMsg = 'Prijem robe je uspešno proknjižen (SAP 101).';
    if (normalizedType === '201_OUTBOUND') successMsg = 'Izdavanje robe je uspešno proknjiženo (SAP 201).';
    if (normalizedType === '551_SCRAP') successMsg = 'Rashodovanje / otpis robe je uspešno proknjiženo (SAP 551).';

    res.status(201).json({
      success: true,
      message: successMsg,
      data: {
        movement_id: insertResult.insertId,
        product_id,
        warehouse_id,
        movement_type: normalizedType,
        quantity: qty,
        new_snapshot_stock: currentQtyInStock + delta,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Greška pri atomskom knjiženju zaliha:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri izvršavanju transakcije knjiženja.' });
  } finally {
    connection.release();
  }
}

/**
 * Periodični proces usaglašavanja stanja (Reconciliation Job)
 * Proverava da li je SUM(stock_movements) == current_stock.quantity za sve artikle i lokacije
 */
export async function getReconciliationReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const query = `
      SELECT 
        p.id AS product_id,
        p.sku AS product_sku,
        p.name AS product_name,
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        w.city AS warehouse_city,
        COALESCE(cs.quantity, 0) AS snapshot_quantity,
        CAST(COALESCE(SUM(
          CASE 
            WHEN sm.movement_type IN ('101_INBOUND', 'INBOUND', '301_TRANSFER_IN') THEN sm.quantity
            WHEN sm.movement_type IN ('201_OUTBOUND', '551_SCRAP', 'OUTBOUND', '301_TRANSFER_OUT') THEN -sm.quantity
            ELSE 0
          END
        ), 0) AS SIGNED) AS ledger_sum
      FROM products p
      CROSS JOIN warehouses w
      LEFT JOIN current_stock cs ON p.id = cs.product_id AND w.id = cs.warehouse_id
      LEFT JOIN stock_movements sm ON p.id = sm.product_id AND w.id = sm.warehouse_id
      WHERE w.is_active = true
      GROUP BY p.id, w.id
      HAVING ledger_sum != 0 OR snapshot_quantity != 0
      ORDER BY p.id ASC, w.id ASC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query);

    let totalDiscrepancies = 0;
    const details: ReconciliationItem[] = rows.map((r) => {
      const ledgerSum = Number(r.ledger_sum);
      const snapshotQty = Number(r.snapshot_quantity);
      const delta = ledgerSum - snapshotQty;
      const isMatch = delta === 0;

      if (!isMatch) totalDiscrepancies++;

      return {
        product_id: r.product_id,
        product_sku: r.product_sku,
        product_name: r.product_name,
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse_name,
        warehouse_city: r.warehouse_city,
        ledger_sum: ledgerSum,
        snapshot_quantity: snapshotQty,
        delta,
        is_match: isMatch,
      };
    });

    const report: ReconciliationReport = {
      is_healthy: totalDiscrepancies === 0,
      total_records_checked: details.length,
      total_discrepancies: totalDiscrepancies,
      timestamp: new Date().toISOString(),
      details,
    };

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Greška pri generisanju reconciliation izveštaja:', error);
    res.status(500).json({ success: false, message: 'Greška pri proveri integriteta stanja.' });
  }
}

/**
 * Automatska sinhronizacija i popravka snimka (Snapshot Sync)
 */
export async function fixReconciliation(req: AuthRequest, res: Response): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obriši snapshot stanja
    await connection.query('DELETE FROM current_stock');

    // 2. Rekonstruiši snapshot iz celokupnog istorijata dnevnika (MATDOC)
    await connection.query(`
      INSERT INTO current_stock (product_id, warehouse_id, quantity)
      SELECT 
        sm.product_id,
        sm.warehouse_id,
        CAST(SUM(
          CASE 
            WHEN sm.movement_type IN ('101_INBOUND', 'INBOUND', '301_TRANSFER_IN') THEN sm.quantity
            WHEN sm.movement_type IN ('201_OUTBOUND', '551_SCRAP', 'OUTBOUND', '301_TRANSFER_OUT') THEN -sm.quantity
            ELSE 0
          END
        ) AS SIGNED) AS calculated_qty
      FROM stock_movements sm
      GROUP BY sm.product_id, sm.warehouse_id
      HAVING calculated_qty != 0
    `);

    await connection.commit();

    res.json({
      success: true,
      message: 'Snapshot tabela (SAP MARD) je uspešno usaglašena sa istorijatom promena (SAP MATDOC).',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Greška pri popravci integriteta:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri usklađivanju tabela.' });
  } finally {
    connection.release();
  }
}
