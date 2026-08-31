import mysql from 'mysql2/promise';
import { ENV } from './env';

export const pool = mysql.createPool({
  host: ENV.DB.HOST,
  port: ENV.DB.PORT,
  user: ENV.DB.USER,
  password: ENV.DB.PASSWORD,
  database: ENV.DB.NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

export async function testDbConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    console.log('✅ [MySQL] Uspešno uspostavljena konekcija sa bazom podataka:', ENV.DB.NAME);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ [MySQL] Greška pri povezivanju sa bazom podataka:', error);
    return false;
  }
}
