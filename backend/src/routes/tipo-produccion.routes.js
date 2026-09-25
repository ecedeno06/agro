import { Router } from 'express';
import {
  getTipoProduccion,
  createTipoProduccion,
  updateTipoProduccion,
  deleteTipoProduccion
} from '../controllers/tipo-produccion.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', getTipoProduccion);
router.post('/', createTipoProduccion);
router.put('/:id', updateTipoProduccion);
router.delete('/:id', deleteTipoProduccion);

export default router;
