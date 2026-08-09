import { Router } from 'express';
import express from 'express';
import { PaymentController } from '../controllers/payment.controller.js';

const router = Router();
const controller = new PaymentController();

router.post(
    '/stripe/webhook',
    express.raw({
        type: 'application/json'
    }),
    (req, res) =>
        controller.stripeWebhook(req, res)
);

export default router;