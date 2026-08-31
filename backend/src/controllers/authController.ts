import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { ENV } from '../config/env';
import { AuthRequest, JwtPayload, UserRole } from '../types';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Molimo unesite ime, email i lozinku.',
      });
      return;
    }

    // Provera da li email već postoji
    const [existingUsers] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Korisnik sa unetom email adresom već postoji.',
      });
      return;
    }

    const assignedRole: UserRole = role === 'ADMIN' ? 'ADMIN' : 'MAGACIONER';
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, assignedRole]
    );

    const userId = result.insertId;
    const payload: JwtPayload = { id: userId, name, email, role: assignedRole };
    const token = jwt.sign(payload, ENV.JWT.SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Registracija je uspešno završena.',
      token,
      user: payload,
    });
  } catch (error) {
    console.error('Greška pri registraciji:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri registraciji.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Molimo unesite email i lozinku.',
      });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Pogrešna email adresa ili lozinka.',
      });
      return;
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Pogrešna email adresa ili lozinka.',
      });
      return;
    }

    const payload: JwtPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, ENV.JWT.SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Uspešna prijava na sistem.',
      token,
      user: payload,
    });
  } catch (error) {
    console.error('Greška pri prijavi:', error);
    res.status(500).json({ success: false, message: 'Serverska greška pri prijavi.' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Niste autorizovani.' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Korisnik nije pronađen.' });
      return;
    }

    res.json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    console.error('Greška pri dohvatanju profila:', error);
    res.status(500).json({ success: false, message: 'Serverska greška.' });
  }
}
