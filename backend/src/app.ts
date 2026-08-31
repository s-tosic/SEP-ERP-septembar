import express, { Request, Response } from 'express';
import cors from 'cors';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorMiddleware';

const app = express();

// Middleware za obradu CORS-a i JSON tela zahteva
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome ruta za proveru u browseru (http://localhost:5000)
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'SEP-MM — Sistemi e-Poslovanja Materials Management (SAP MM/WM)',
    version: '1.0.0',
    message: 'Backend REST API je aktivan! Korisnički interfejs otvorite na: http://localhost:3000',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      warehouses: '/api/warehouses',
      products: '/api/products',
      stock_movements: '/api/stock-movements',
      reconcile: '/api/stock-movements/reconcile',
      dashboard: '/api/dashboard/stats',
    },
  });
});

// Osnovni health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SEP-MM - Sistemi e-Poslovanja Materials Management API',
    timestamp: new Date().toISOString(),
  });
});

// Registracija svih API ruta
app.use('/api', apiRouter);

// Centralizovani middleware za obradu grešaka
app.use(errorHandler);

export default app;
