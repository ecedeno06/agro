import { Router } from 'express';
import {
  getPaises,
  createPais,
  updatePais,
  deletePais
} from '../controllers/paises.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', getPaises);
router.post('/', createPais);
router.put('/:id', updatePais);
router.delete('/:id', deletePais);

export default router;
