import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();
const controller = new AuthController();

router.post(
    '/admin/login',
    (req, res) =>
        controller.login(req, res)
);

export default router;