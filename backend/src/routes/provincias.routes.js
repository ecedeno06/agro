import { Router } from 'express';
import { getProvincias } from '../controllers/provincias.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProvincias);

export default router;
