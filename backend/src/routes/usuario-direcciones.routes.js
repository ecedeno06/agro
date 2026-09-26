import { Router } from 'express';
import {
  listarDirecciones,
  crearDireccion,
  actualizarDireccion,
  eliminarDireccion
} from '../controllers/usuario-direcciones.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listarDirecciones);
router.post('/', crearDireccion);
router.put('/:id', actualizarDireccion);
router.delete('/:id', eliminarDireccion);

export default router;
