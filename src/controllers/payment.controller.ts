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

        console.log('========== STRIPE WEBHOOK ==========');

        const signature =
            req.headers['stripe-signature'];

        console.log(
            'Signature exists:',
            !!signature
        );

        if (!signature) {

            console.error(
                'Missing stripe signature'
            );

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

        console.log(
            'Stripe event type:',
            event.type
        );

        if (
            event.type ===
            'checkout.session.completed'
        ) {

            const session =
                event.data.object as Stripe.Checkout.Session;

            console.log(
                'Stripe session ID:',
                session.id
            );

            console.log(
                'Stripe payment status:',
                session.payment_status
            );

            console.log(
                'Stripe metadata:',
                session.metadata
            );

            const bookingId =
                session.metadata?.bookingId;

            console.log(
                'Booking ID:',
                bookingId
            );

            if (!bookingId) {

                console.error(
                    'NO BOOKING ID IN STRIPE METADATA'
                );

                return res
                    .status(400)
                    .send('Missing booking ID');

            }

            console.log(
                'Calling confirmPayment...'
            );

            await paymentService.confirmPayment(
                bookingId
            );

            console.log(
                'confirmPayment completed'
            );

        }

        res.json({
            received: true
        });

    }

    catch (error) {

        console.error(
            'STRIPE WEBHOOK ERROR:',
            error
        );

        res
            .status(400)
            .send('Webhook error');

    }

}

}