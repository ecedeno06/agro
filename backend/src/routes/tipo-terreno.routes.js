import { Router } from 'express';
import {
  getTipoTerreno,
  createTipoTerreno,
  updateTipoTerreno,
  deleteTipoTerreno
} from '../controllers/tipo-terreno.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getTipoTerreno);
router.post('/', authMiddleware, createTipoTerreno);
router.put('/:id', authMiddleware, updateTipoTerreno);
router.delete('/:id', authMiddleware, deleteTipoTerreno);

export default router;
