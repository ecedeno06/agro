import express from 'express';
import * as fenomenosController from '../controllers/fenomenos.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', authMiddleware, fenomenosController.getFenomenos);
router.get('/:id', authMiddleware, fenomenosController.getFenomenoById);
router.post('/', authMiddleware, fenomenosController.crearFenomeno);
router.put('/:id', authMiddleware, fenomenosController.actualizarFenomeno);
router.put('/:id/toggle', authMiddleware, fenomenosController.toggleEstadoFenomeno);

export default router;
