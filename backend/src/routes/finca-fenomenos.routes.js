import express from 'express';
import * as fincaFenomenosController from '../controllers/finca-fenomenos.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/finca/:idFinca', authMiddleware, fincaFenomenosController.getFenomenosPorFinca);
router.post('/', authMiddleware, fincaFenomenosController.asignarFenomenoAFinca);
router.put('/:id/toggle', authMiddleware, fincaFenomenosController.toggleEstadoFincaFenomeno);
router.delete('/:id', authMiddleware, fincaFenomenosController.eliminarFincaFenomeno);

export default router;
