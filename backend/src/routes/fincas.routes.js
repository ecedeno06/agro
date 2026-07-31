import express from 'express';
import * as fincasController from '../controllers/fincas.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren token de sesión activo
router.use(authMiddleware);

// Rutas de lectura (abiertas a todos los usuarios autenticados)
router.get('/', fincasController.getFincas);
router.get('/:id', fincasController.getFincaById);

// Rutas de escritura y modificación (restringidas a Propietarios y Admins dentro del controlador)
router.post('/', fincasController.crearFinca);
router.put('/:id', fincasController.actualizarFinca);
router.delete('/:id', fincasController.eliminarFinca);

export default router;
