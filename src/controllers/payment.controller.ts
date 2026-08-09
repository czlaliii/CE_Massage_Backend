import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { PaymentService } from '../services/payment.service.js';

const stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY!
);

const paymentService =
    new PaymentService();

export class PaymentController {

    async stripeWebhook(
        req: Request,
        res: Response
    ) {

        try {

            const signature =
                req.headers['stripe-signature'];

            if (!signature) {

                return res
                    .status(400)
                    .send('Missing signature');

            }

            const event =
                stripe.webhooks.constructEvent(
                    req.body,
                    signature,
                    process.env.STRIPE_WEBHOOK_SECRET!
                );

            if (
                event.type ===
                'checkout.session.completed'
            ) {

                const session =
                    event.data.object as Stripe.Checkout.Session;

                const bookingId =
                    session.metadata?.bookingId;

                if (bookingId) {

                    await paymentService.confirmPayment(
                        bookingId
                    );

                }

            }

            res.json({
                received: true
            });

        }

        catch (error) {

            console.error(error);

            res
                .status(400)
                .send('Webhook error');

        }

    }

}