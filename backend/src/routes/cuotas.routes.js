import express from 'express';
import * as cuotasController from '../controllers/cuotas.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren token de sesión activo
router.use(authMiddleware);

router.get('/', cuotasController.getCuotas);
router.get('/capitulos', cuotasController.getCapitulosAsociados);
router.post('/', cuotasController.registrarPagoCuota);

export default router;
