import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';

export async function getAllProducts(req: Request, res: Response): Promise<void> {
  try {
    // Čitanje trenutnog stanja direktno iz MARD Snapshot tabele (current_stock) za maksimalne performanse
    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.category,
        p.unit_of_measure,
        p.unit_price,
        p.min_threshold,
        p.created_at,
        CAST(COALESCE(SUM(cs.quantity), 0) AS SIGNED) AS current_stock
      FROM products p
      LEFT JOIN current_stock cs ON p.id = cs.product_id
      GROUP BY p.id
      ORDER BY p.id ASC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query);

    const productsWithTotals = rows.map((p) => {
      const currentStock = Number(p.current_stock) || 0;
      const unitPrice = Number(p.unit_price) || 0;
      const minThreshold = Number(p.min_threshold) || 0;

      let stockStatus: 'OPTIMALNO' | 'KRITIČNO' | 'NEMA NA STANJU' = 'OPTIMALNO';
      if (currentStock <= 0) {
        stockStatus = 'NEMA NA STANJU';
      } else if (currentStock <= minThreshold) {
        stockStatus = 'KRITIČNO';
      }

      return {
        ...p,
        current_stock: currentStock,
        unit_price: unitPrice,
        min_threshold: minThreshold,
        total_value: currentStock * unitPrice,
        stock_status: stockStatus,
      };
    });

    res.json({
      success: true,
      data: productsWithTotals,
    });
  } catch (error) {
    console.error('Greška pri dohvatanju artikala:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri dohvatanju artikala.' });
  }
}

export async function getProductById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.*,
        CAST(COALESCE(SUM(cs.quantity), 0) AS SIGNED) AS current_stock
      FROM products p
      LEFT JOIN current_stock cs ON p.id = cs.product_id
      WHERE p.id = ?
      GROUP BY p.id
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, [id]);

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Artikal nije pronađen.' });
      return;
    }

    // Raspodela stanja po skladištima iz Snapshot tabele
    const [warehouseStocks] = await pool.query<RowDataPacket[]>(
      `SELECT 
         w.id AS warehouse_id,
         w.name AS warehouse_name,
         w.city AS warehouse_city,
         CAST(COALESCE(cs.quantity, 0) AS SIGNED) AS stock_in_warehouse
       FROM warehouses w
       LEFT JOIN current_stock cs ON w.id = cs.warehouse_id AND cs.product_id = ?
       WHERE w.is_active = true
       ORDER BY w.id ASC`,
      [id]
    );

    const currentStock = Number(rows[0].current_stock) || 0;
    const minThreshold = Number(rows[0].min_threshold) || 0;

    let stockStatus: 'OPTIMALNO' | 'KRITIČNO' | 'NEMA NA STANJU' = 'OPTIMALNO';
    if (currentStock <= 0) {
      stockStatus = 'NEMA NA STANJU';
    } else if (currentStock <= minThreshold) {
      stockStatus = 'KRITIČNO';
    }

    res.json({
      success: true,
      data: {
        ...rows[0],
        current_stock: currentStock,
        stock_status: stockStatus,
        warehouse_breakdown: warehouseStocks,
      },
    });
  } catch (error) {
    console.error('Greška pri dohvatanju artikla:', error);
    res.status(500).json({ success: false, message: 'Serverska greška.' });
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const { sku, name, category, unit_of_measure, unit_price, min_threshold } = req.body;

    if (!sku || !name || !category) {
      res.status(400).json({
        success: false,
        message: 'Molimo unesite šifru (SKU), naziv i kategoriju artikla.',
      });
      return;
    }

    // Provera da li SKU već postoji
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM products WHERE sku = ?',
      [sku]
    );

    if (existing.length > 0) {
      res.status(400).json({
        success: false,
        message: `Artikal sa šifrom (SKU) "${sku}" već postoji u katalogu.`,
      });
      return;
    }

    const price = unit_price !== undefined ? Number(unit_price) : 0;
    const threshold = min_threshold !== undefined ? Number(min_threshold) : 10;
    const uom = unit_of_measure || 'kom';

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO products (sku, name, category, unit_of_measure, unit_price, min_threshold) VALUES (?, ?, ?, ?, ?, ?)',
      [sku, name, category, uom, price, threshold]
    );

    res.status(201).json({
      success: true,
      message: 'Artikal je uspešno dodat u katalog.',
      data: {
        id: result.insertId,
        sku,
        name,
        category,
        unit_of_measure: uom,
        unit_price: price,
        min_threshold: threshold,
        current_stock: 0,
      },
    });
  } catch (error) {
    console.error('Greška pri kreiranju artikla:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri kreiranju artikla.' });
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { sku, name, category, unit_of_measure, unit_price, min_threshold } = req.body;

    if (!sku || !name || !category) {
      res.status(400).json({
        success: false,
        message: 'Molimo popunite obavezna polja (SKU, naziv, kategorija).',
      });
      return;
    }

    // Provera da li SKU pripada nekom drugom artiklu
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM products WHERE sku = ? AND id != ?',
      [sku, id]
    );

    if (existing.length > 0) {
      res.status(400).json({
        success: false,
        message: `Šifra (SKU) "${sku}" se već koristi na drugom artiklu.`,
      });
      return;
    }

    const price = unit_price !== undefined ? Number(unit_price) : 0;
    const threshold = min_threshold !== undefined ? Number(min_threshold) : 10;
    const uom = unit_of_measure || 'kom';

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE products SET sku = ?, name = ?, category = ?, unit_of_measure = ?, unit_price = ?, min_threshold = ? WHERE id = ?',
      [sku, name, category, uom, price, threshold, id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Artikal nije pronađen.' });
      return;
    }

    res.json({
      success: true,
      message: 'Podaci o artiklu su uspešno ažurirani.',
    });
  } catch (error) {
    console.error('Greška pri ažuriranju artikla:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri ažuriranju artikla.' });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM products WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Artikal nije pronađen.' });
      return;
    }

    res.json({
      success: true,
      message: 'Artikal je uspešno obrisan.',
    });
  } catch (error) {
    console.error('Greška pri brisanju artikla:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri brisanju artikla.' });
  }
}
