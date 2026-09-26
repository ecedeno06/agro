import { Router } from 'express';
import {
  getOcupaciones,
  createOcupacion,
  updateOcupacion,
  toggleEstadoOcupacion
} from '../controllers/ocupacion.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getOcupaciones);
router.post('/', createOcupacion);
router.put('/:id', updateOcupacion);
router.put('/:id/toggle', toggleEstadoOcupacion);

export default router;
