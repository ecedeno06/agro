import express from 'express';
import * as controller from '../controllers/finca-productos.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', controller.getFincaProductos);
router.post('/', controller.addFincaProducto);
router.put('/:id', controller.updateFincaProducto);
router.put('/:id/toggle', controller.toggleEstadoFincaProducto);
router.delete('/:id', controller.deleteFincaProducto);

export default router;
