import { Router } from 'express';
import { reverseGeocode } from '../controllers/geocodificacion.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/reverse', reverseGeocode);

export default router;
