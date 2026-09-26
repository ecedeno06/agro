import { Router } from 'express';
import { getDistritos } from '../controllers/distritos.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getDistritos);

export default router;
