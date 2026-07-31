import express from 'express';
import * as navigationController from '../controllers/navigation.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/menu', authMiddleware, navigationController.getMenu);
router.get('/permissions', authMiddleware, navigationController.getPermissions);

export default router;
