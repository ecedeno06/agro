import express from 'express';
import * as maintenanceController from '../controllers/maintenance.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// Rutas de Matriz de Permisos
router.get('/roles', authMiddleware, maintenanceController.getRoles);
router.get('/menus', authMiddleware, maintenanceController.getMenus);
router.get('/permissions-list', authMiddleware, maintenanceController.getPermissionsList);
router.get('/role-permissions/:rolId', authMiddleware, maintenanceController.getRolePermissions);
router.post('/role-permissions', authMiddleware, maintenanceController.saveRolePermissions);
router.post('/roles', authMiddleware, maintenanceController.crearRol);
router.post('/permissions-list', authMiddleware, maintenanceController.crearPermiso);
router.get('/roles-all', authMiddleware, maintenanceController.getRolesAll);
router.put('/roles/:idRol', authMiddleware, maintenanceController.updateRol);
router.get('/permissions-list-all', authMiddleware, maintenanceController.getPermissionsListAll);
router.put('/permissions/:id', authMiddleware, maintenanceController.updatePermiso);
router.get('/menus-all', authMiddleware, maintenanceController.getMenusAll);
router.post('/menus', authMiddleware, maintenanceController.crearMenu);
router.put('/menus/:id', authMiddleware, maintenanceController.updateMenu);
router.get('/icons-list', authMiddleware, maintenanceController.getIconsList);

// Rutas de Asignación de Roles a Usuarios
router.get('/users', authMiddleware, maintenanceController.getUsers);
router.get('/chapters', authMiddleware, maintenanceController.getChapters);
router.get('/user-roles/:userId', authMiddleware, maintenanceController.getUserRoles);
router.post('/user-roles', authMiddleware, maintenanceController.saveUserRole);
router.delete('/user-roles/:idRegistro', authMiddleware, maintenanceController.deleteUserRole);
router.post('/change-password', authMiddleware, maintenanceController.changePassword);

export default router;
