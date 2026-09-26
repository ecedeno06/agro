import { Router } from 'express';
import { getProvincias, createProvincia, updateProvincia, deleteProvincia } from '../controllers/provincias.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getProvincias);
router.post('/', createProvincia);
router.put('/:id', updateProvincia);
router.delete('/:id', deleteProvincia);

export default router;
