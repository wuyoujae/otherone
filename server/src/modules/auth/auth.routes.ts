import { Router } from 'express';
import { register, login, getProfile, resetPasswordLocal } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/reset-password-local', resetPasswordLocal);
router.get('/profile', authenticate, getProfile);

export default router;
