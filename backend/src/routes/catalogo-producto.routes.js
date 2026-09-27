import { Router } from 'express';
import {
  getProductos,
  createProducto,
  updateProducto,
  toggleEstadoProducto
} from '../controllers/catalogo-producto.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProductos);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.put('/:id/toggle', toggleEstadoProducto);

export default router;
