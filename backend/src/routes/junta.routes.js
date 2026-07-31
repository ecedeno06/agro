import express from 'express';
import * as juntaController from '../controllers/junta.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// Obtener miembros de la junta de una empresa
router.get('/:idEmpresa', authMiddleware, juntaController.getJuntaDirectiva);

// Agregar un miembro a la junta
router.post('/', authMiddleware, juntaController.agregarMiembro);

// Eliminar un miembro de la junta
router.delete('/:idJuntaDirectiva', authMiddleware, juntaController.eliminarMiembro);

export default router;
