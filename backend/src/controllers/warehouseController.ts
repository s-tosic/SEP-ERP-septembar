import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';

export async function getAllWarehouses(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM warehouses ORDER BY id ASC'
    );
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('Greška pri dohvatanju skladišta:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri dohvatanju skladišta.' });
  }
}

export async function getWarehouseById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM warehouses WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Skladište nije pronađeno.' });
      return;
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error('Greška pri dohvatanju skladišta:', error);
    res.status(500).json({ success: false, message: 'Serverska greška.' });
  }
}

export async function createWarehouse(req: Request, res: Response): Promise<void> {
  try {
    const { code, name, city, address, capacity_sqm, is_active } = req.body;

    if (!code || !name || !city || !address) {
      res.status(400).json({
        success: false,
        message: 'Molimo unesite šifru, naziv, grad i adresu skladišta.',
      });
      return;
    }

    // Provera jedinstvenosti šifre
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM warehouses WHERE code = ?',
      [code]
    );

    if (existing.length > 0) {
      res.status(400).json({
        success: false,
        message: `Skladište sa šifrom "${code}" već postoji.`,
      });
      return;
    }

    const capacity = capacity_sqm ? Number(capacity_sqm) : 1000;
    const active = is_active !== undefined ? Boolean(is_active) : true;

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO warehouses (code, name, city, address, capacity_sqm, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, city, address, capacity, active]
    );

    res.status(201).json({
      success: true,
      message: 'Skladište je uspešno kreirano.',
      data: {
        id: result.insertId,
        code,
        name,
        city,
        address,
        capacity_sqm: capacity,
        is_active: active,
      },
    });
  } catch (error) {
    console.error('Greška pri kreiranju skladišta:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri kreiranju skladišta.' });
  }
}

export async function updateWarehouse(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { code, name, city, address, capacity_sqm, is_active } = req.body;

    if (!code || !name || !city || !address) {
      res.status(400).json({
        success: false,
        message: 'Molimo unesite obavezna polja (šifra, naziv, grad, adresa).',
      });
      return;
    }

    // Provera da li šifra pripada nekom drugom skladištu
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM warehouses WHERE code = ? AND id != ?',
      [code, id]
    );

    if (existing.length > 0) {
      res.status(400).json({
        success: false,
        message: `Šifra "${code}" se već koristi na drugom skladištu.`,
      });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE warehouses SET code = ?, name = ?, city = ?, address = ?, capacity_sqm = ?, is_active = ? WHERE id = ?',
      [code, name, city, address, Number(capacity_sqm) || 1000, is_active !== undefined ? Boolean(is_active) : true, id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Skladište nije pronađeno.' });
      return;
    }

    res.json({
      success: true,
      message: 'Podaci o skladištu su uspešno ažurirani.',
    });
  } catch (error) {
    console.error('Greška pri ažuriranju skladišta:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri ažuriranju skladišta.' });
  }
}

export async function deleteWarehouse(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Provera da li postoje knjiženja za ovo skladište
    const [movements] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM stock_movements WHERE warehouse_id = ? LIMIT 1',
      [id]
    );

    if (movements.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Nije moguće obrisati skladište jer postoje evidentirane promene zaliha (knjiženja) povezane sa njim.',
      });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM warehouses WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Skladište nije pronađeno.' });
      return;
    }

    res.json({
      success: true,
      message: 'Skladište je uspešno obrisano.',
    });
  } catch (error) {
    console.error('Greška pri brisanju skladišta:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri brisanju skladišta.' });
  }
}
