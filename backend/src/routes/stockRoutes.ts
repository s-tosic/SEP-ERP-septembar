import { Router } from 'express';
import {
  getAllMovements,
  createMovement,
  getReconciliationReport,
  fixReconciliation,
} from '../controllers/stockController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Sve rute zahtevaju validan JWT token
router.use(authenticateToken);

router.get('/', getAllMovements);
router.post('/', createMovement);
router.get('/reconcile', getReconciliationReport);
router.post('/reconcile/fix', fixReconciliation);

export default router;
