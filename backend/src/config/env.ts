import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: Number(process.env.DB_PORT) || 3306,
    USER: process.env.DB_USER || 'root',
    PASSWORD: process.env.DB_PASSWORD || 'root',
    NAME: process.env.DB_NAME || 'sep_mm',
  },
  JWT: {
    SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_sep_mm_2026_exam',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  },
};
