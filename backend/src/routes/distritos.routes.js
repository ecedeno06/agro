import { Router } from 'express';
import { getDistritos, createDistrito, updateDistrito, deleteDistrito } from '../controllers/distritos.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getDistritos);
router.post('/', createDistrito);
router.put('/:id', updateDistrito);
router.delete('/:id', deleteDistrito);

export default router;
