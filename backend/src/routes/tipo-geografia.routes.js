import { Router } from 'express';
import {
  getTipoGeografia,
  createTipoGeografia,
  updateTipoGeografia,
  deleteTipoGeografia
} from '../controllers/tipo-geografia.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getTipoGeografia);
router.post('/', authMiddleware, createTipoGeografia);
router.put('/:id', authMiddleware, updateTipoGeografia);
router.delete('/:id', authMiddleware, deleteTipoGeografia);

export default router;
