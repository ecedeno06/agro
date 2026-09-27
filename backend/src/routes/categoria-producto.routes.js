import { Router } from 'express';
import {
  getCategorias,
  getCategoriasReferencia,
  createCategoria,
  updateCategoria,
  toggleEstadoCategoria
} from '../controllers/categoria-producto.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/referencia', getCategoriasReferencia);
router.get('/', getCategorias);
router.post('/', createCategoria);
router.put('/:id', updateCategoria);
router.put('/:id/toggle', toggleEstadoCategoria);

export default router;
