import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    // 1. Broj skladišta
    const [whCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM warehouses WHERE is_active = true'
    );

    // 2. Broj artikala
    const [prodCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM products'
    );

    // 3. Broj promena u Ledgeru (MATDOC)
    const [movCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM stock_movements'
    );

    // 4. Stanja zaliha direktno iz Snapshot tabele (MARD)
    const [products] = await pool.query<RowDataPacket[]>(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.category,
        p.unit_of_measure,
        p.unit_price,
        p.min_threshold,
        CAST(COALESCE(SUM(cs.quantity), 0) AS SIGNED) AS current_stock
      FROM products p
      LEFT JOIN current_stock cs ON p.id = cs.product_id
      GROUP BY p.id
    `);

    let totalStockItems = 0;
    let totalInventoryValue = 0;
    const lowStockList: any[] = [];

    products.forEach((p) => {
      const stock = Number(p.current_stock) || 0;
      const price = Number(p.unit_price) || 0;
      const threshold = Number(p.min_threshold) || 0;

      totalStockItems += stock;
      totalInventoryValue += stock * price;

      if (stock <= threshold) {
        lowStockList.push({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit_of_measure: p.unit_of_measure,
          current_stock: stock,
          min_threshold: threshold,
          is_out_of_stock: stock <= 0,
        });
      }
    });

    // 5. Poslednjih 5 knjiženja iz Ledgera (MATDOC)
    const [recentMovements] = await pool.query<RowDataPacket[]>(`
      SELECT 
        sm.id,
        sm.movement_type,
        sm.quantity,
        sm.reference_doc,
        sm.notes,
        sm.movement_date,
        p.sku AS product_sku,
        p.name AS product_name,
        p.unit_of_measure,
        w.name AS warehouse_name,
        w.city AS warehouse_city,
        u.name AS user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      JOIN users u ON sm.user_id = u.id
      ORDER BY sm.movement_date DESC, sm.id DESC
      LIMIT 5
    `);

    // 6. Pregled zaliha i finansijske vrednosti po lokacijama (Beograd, Niš, Vršac)
    const [warehouseStats] = await pool.query<RowDataPacket[]>(`
      SELECT 
        w.id,
        w.code,
        w.name,
        w.city,
        CAST(COALESCE(SUM(cs.quantity), 0) AS SIGNED) AS total_items,
        CAST(COALESCE(SUM(cs.quantity * p.unit_price), 0) AS DECIMAL(14,2)) AS total_inventory_value,
        COUNT(DISTINCT CASE WHEN cs.quantity > 0 THEN cs.product_id END) AS distinct_products_count,
        (SELECT COUNT(*) FROM stock_movements sm WHERE sm.warehouse_id = w.id) AS total_movements
      FROM warehouses w
      LEFT JOIN current_stock cs ON w.id = cs.warehouse_id
      LEFT JOIN products p ON cs.product_id = p.id
      WHERE w.is_active = true
      GROUP BY w.id
    `);

    res.json({
      success: true,
      data: {
        kpis: {
          total_warehouses: Number(whCount[0]?.count) || 0,
          total_products: Number(prodCount[0]?.count) || 0,
          total_movements: Number(movCount[0]?.count) || 0,
          total_stock_items: totalStockItems,
          total_inventory_value: totalInventoryValue,
          critical_stock_count: lowStockList.length,
          architecture: 'SAP MM Dual-Ledger (MATDOC + MARD)',
        },
        low_stock_products: lowStockList,
        recent_movements: recentMovements,
        warehouse_stats: warehouseStats.map((wh) => ({
          ...wh,
          total_inventory_value: Number(wh.total_inventory_value) || 0,
          distinct_products_count: Number(wh.distinct_products_count) || 0,
          total_items: Number(wh.total_items) || 0,
          total_movements: Number(wh.total_movements) || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Greška pri dohvatanju statistike kontrolne table:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri dohvatanju statistike.' });
  }
}
