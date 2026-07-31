import { Router } from 'express';
import {
  getTipoEstadoLegal,
  createTipoEstadoLegal,
  updateTipoEstadoLegal,
  deleteTipoEstadoLegal
} from '../controllers/tipo-estado-legal.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getTipoEstadoLegal);
router.post('/', authMiddleware, createTipoEstadoLegal);
router.put('/:id', authMiddleware, updateTipoEstadoLegal);
router.delete('/:id', authMiddleware, deleteTipoEstadoLegal);

export default router;
