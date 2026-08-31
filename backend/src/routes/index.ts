import { Router } from 'express';
import authRoutes from './authRoutes';
import warehouseRoutes from './warehouseRoutes';
import productRoutes from './productRoutes';
import stockRoutes from './stockRoutes';
import dashboardRoutes from './dashboardRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/products', productRoutes);
router.use('/stock-movements', stockRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
