import { Router } from 'express';
import {
  getTipoSuelos,
  createTipoSuelo,
  updateTipoSuelo,
  deleteTipoSuelo
} from '../controllers/tipo-suelos.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', getTipoSuelos);
router.post('/', createTipoSuelo);
router.put('/:id', updateTipoSuelo);
router.delete('/:id', deleteTipoSuelo);

export default router;
