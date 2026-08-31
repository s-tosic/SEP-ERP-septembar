import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Sve rute zahtevaju validan JWT token
router.use(authenticateToken);

router.get('/stats', getDashboardStats);

export default router;
