import 'dotenv/config';
import Stripe from 'stripe';
import express from 'express';
import cors from 'cors';
import { supabase } from './config/supabase.js';
import { BookingService } from './services/booking.service.js';
import { AuthService } from './services/auth.service.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { PaymentService } from './services/payment.service.js';
import { PaymentCleanupService } from './services/payment-cleanup.service.js';

const app = express();
const bookingService = new BookingService();
const authService = new AuthService();
const paymentService = new PaymentService();
const paymentCleanupService = new PaymentCleanupService();
const stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY!
);

app.use(cors({
    origin: process.env
        .FRONTEND_URL
        ?.split(',')
}));

app.post(
    '/payments/webhook',

    express.raw({
        type: 'application/json'
    }),

    async (req, res) => {

        const signature =
            req.headers['stripe-signature'];

        if (!signature) {

            return res
                .status(400)
                .send(
                    'Missing signature'
                );
        }

        let event: Stripe.Event;

        try {

            event =
                stripe.webhooks.constructEvent(

                    req.body,

                    signature,

                    process.env
                        .STRIPE_WEBHOOK_SECRET!
                );

        } catch (error) {

            console.error(
                'Webhook signature error:',
                error
            );

            return res
                .status(400)
                .send(
                    'Invalid signature'
                );
        }

        console.log(
            'Stripe event:',
            event.type
        );

        try {

            if (
                event.type ===
                'checkout.session.completed'
            ) {

                const session =
                    event.data.object as Stripe.Checkout.Session;

                const bookingId =
                    session.metadata?.bookingId;

                if (bookingId) {

                    await paymentService
                        .confirmPayment(
                            bookingId
                        );
                }
            }

            res.sendStatus(200);

        } catch (error) {

            console.error(
                'Webhook error:',
                error
            );

            res.sendStatus(500);
        }
    }
);

app.use(express.json());

app.get('/health', (_, res) => {
    res.json({ status: 'ok' });
});

app.get('/services', async (_, res) => {
    const { data, error } = await supabase
    .from('services')
    .select('*');

    if (error) {
        return res.status(500).json(error);
    }

    res.json(data);
});

app.get(
    '/admin/dashboard',
    authMiddleware,
    async (_, res) => {

        try {

            const stats =
                await bookingService
                    .getDashboardStats();

            res.json(
                stats
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    'Failed to load dashboard'
            });
        }
    }
);

app.get(
    '/bookings/reschedule/:token',
    async (req, res) => {

        try {

            const booking =
                await bookingService
                    .getBookingByToken(
                        req.params.token
                    );

            res.json(
                booking
            );

        } catch {

            res.status(404).json({
                message:
                    'Booking not found'
            });
        }
    }
);

app.get('/bookings', authMiddleware, async (req, res) => {

    try {

        const date =
            req.query.date as string;

        const bookings =
            await bookingService
                .getBookings(date);

        res.json(bookings);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message:
                'Failed to fetch bookings'
        });
    }
});

app.post(
    '/bookings/reschedule/:token',
    async (req, res) => {

        try {

            const {
                bookingDate,
                startTime
            } = req.body;

            const result =
                await bookingService
                    .rescheduleBooking(
                        req.params.token,
                        bookingDate,
                        startTime
                    );

            res.json(
                result
            );

        } catch (error) {

            if (
                error instanceof Error
            ) {

                if (
                    error.message ===
                    'RESCHEDULE_PERIOD_EXPIRED'
                ) {

                    return res
                        .status(400)
                        .json({
                            message:
                            'A foglalás már nem módosítható.'
                        });
                }

                if (
                    error.message ===
                    'TIME_SLOT_ALREADY_BOOKED'
                ) {

                    return res
                        .status(400)
                        .json({
                            message:
                            'Ez az időpont már foglalt.'
                        });
                }
            }

            res.status(500).json({
                message:
                    'Server error'
            });
        }
    }
);

app.post('/bookings', async (req, res) => {

    try {

        const booking =
            await bookingService.createBooking(
                req.body
            );

        res.status(201).json(booking);

    } catch (error: any) {

        if (
            error.message ===
            'TIME_SLOT_ALREADY_BOOKED'
        ) {
            return res.status(409).json({
                message:
                    'Selected time slot is already booked'
            });
        }

        console.error(error);

        res.status(500).json({
            message:
                'Booking creation failed'
        });
    }
});

app.get('/slots', async (req, res) => {

    const date = req.query.date as string;
    const serviceId = req.query.serviceId as string;

    const slots =
        await bookingService.getAvailableSlots(
            date,
            serviceId
        );

    res.json(slots);
});

app.get(
    '/payments/status/:paymentId',
    async (req, res) => {

        const paid =
            await paymentService
                .verifyPayment(
                    req.params.paymentId
                );

        res.json({
            paid
        });
    }
);

app.post(
    '/auth/login',
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;

            const result =
                await authService.login(
                    username,
                    password
                );

            res.json(result);

        } catch {

            res.status(401).json({
                message:
                    'Invalid credentials'
            });
        }
    }
);

app.post(
    '/payments/create',
    async (req, res) => {

        try {

            const result =
                await paymentService
                    .createPayment(
                        req.body
                    );

            res.json(
                result
            );

        } catch {

            res.status(500).json({
                message:
                    'Payment creation failed'
            });
        }
    }
);

app.post(
    '/payments/mock-success',
    async (req, res) => {

        const {
            bookingId
        } = req.body;

        const result =
            await paymentService
                .confirmPayment(
                    bookingId
                );

        res.json(
            result
        );
    }
);

app.delete('/bookings/:id', authMiddleware, async (req, res) => {

        try {

            const bookingId = req.params.id;

            if (!bookingId || Array.isArray(bookingId)) {
                return res.status(400).json({
                    message: 'Invalid booking id'
                });
            }

            const booking =
                await bookingService.cancelBooking(
                    bookingId
                );

            res.json(booking);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    'Failed to cancel booking'
            });
        }
    }
);

setInterval(
    async () => {

        try {

            const cleaned =
                await paymentCleanupService
                    .cleanupExpiredPayments();

            if (
                cleaned &&
                cleaned.length > 0
            ) {

                console.log(
                    'Expired bookings cancelled:',
                    cleaned.length
                );
            }

        } catch (error) {

            console.error(
                'Cleanup failed:',
                error
            );
        }

    },

    5 * 60 * 1000
);

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started');
});

console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);