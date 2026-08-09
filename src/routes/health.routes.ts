import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';
import { HomeController } from '../controllers/home.controller.js';

const router = Router();

const health = new HealthController();
const home = new HomeController();

router.get(
    '/',
    (req, res) =>
        home.index(req, res)
);

router.get(
    '/health',
    (req, res) =>
        health.health(req, res)
);

export default router;