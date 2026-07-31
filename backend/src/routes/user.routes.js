import express from 'express';
import * as userController from '../controllers/user.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// Obtener todos los usuarios
router.get('/', authMiddleware, userController.getUsuarios);

// Registrar un nuevo usuario (Requiere estar autenticado)
router.post('/', authMiddleware, userController.crearUsuario);

// Cambiar contraseña (Requiere estar autenticado)
router.put('/cambiar-password', authMiddleware, userController.cambiarPassword);

// Generar una contraseña segura según políticas de .env
router.get('/generar-password', authMiddleware, userController.generarPassword);

// Rutas de gestión de roles de usuario
router.get('/roles-catalogo', authMiddleware, userController.getCatalogoRoles);
router.get('/:id/roles', authMiddleware, userController.getRolesUsuario);
router.post('/:id/roles', authMiddleware, userController.asignarRolUsuario);
router.put('/roles/:idRegistro/toggle', authMiddleware, userController.toggleEstadoRolUsuario);
router.delete('/roles/:idRegistro', authMiddleware, userController.eliminarRolUsuario);

// Rutas de avatar del usuario autenticado
router.put('/avatar', authMiddleware, userController.actualizarAvatar);
router.delete('/avatar', authMiddleware, userController.eliminarAvatar);

export default router;
