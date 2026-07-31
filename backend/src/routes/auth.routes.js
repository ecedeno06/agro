import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', authController.login);
router.post('/select-rol', authController.selectRol);
router.post('/forgot-password', authController.forgotPassword);
router.get('/pista', authController.obtenerPista);
router.get('/me', authMiddleware, authController.me);

// Rutas de Control de Sesión
router.post('/logout', authController.logout);
router.post('/refresh-session', authController.refreshSession);
router.get('/session-config', authController.getSessionConfig);

// Rutas de Doble Factor (2FA) (idénticas a Mascotas)
router.post('/2fa/setup', authController.setup2FA);
router.post('/2fa/enable', authController.enable2FA);
router.post('/2fa/disable', authController.disable2FA);
router.post('/2fa/verify-login', authController.verifyLogin2FA);

export default router;
