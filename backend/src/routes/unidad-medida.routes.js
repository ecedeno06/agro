import { Router } from 'express';
import { getUnidadesMedida } from '../controllers/unidad-medida.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getUnidadesMedida);

export default router;
