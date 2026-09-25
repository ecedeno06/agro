import { Router } from 'express';
import { listarSesiones, cerrarSesiones } from '../controllers/auditoria.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/sesiones', listarSesiones);
router.post('/sesiones/cerrar', cerrarSesiones);

export default router;
