import './config/env.js';
import express from 'express';
import type {
    Request,
    Response,
    NextFunction
} from 'express';
import cors from 'cors';
// import { PaymentCleanupService } from './services/payment-cleanup.service.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import authRoutes from './routes/auth.routes.js';
import serviceRoutes from './routes/service.routes.js';
import healthRoutes from './routes/health.routes.js';
import blockedTimeRoutes from './routes/blocked-time.routes.js';

const app = express();
// const paymentCleanupService = new PaymentCleanupService();

app.use(cors({
    origin:
        process.env.FRONTEND_URL
            ?.split(',')
}));

app.use('/payments', paymentRoutes);

app.use(express.json());

app.use(healthRoutes);
app.use(serviceRoutes);
app.use(bookingRoutes);
app.use(blockedTimeRoutes);
app.use(authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server started on port ${PORT}`);

});

// setInterval(async () => {

//     try {

//         const cleaned =
//             await paymentCleanupService
//                 .cleanupExpiredPayments();

//         if (cleaned.length > 0) {

//             console.log(
//                 `Expired bookings cancelled: ${cleaned.length}`
//             );

//         }

//     } catch (error) {

//         console.error(
//             'Cleanup failed:',
//             error
//         );

//     }

// }, 5 * 60 * 1000);

app.use((
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {

    console.error(err);

    res.status(500).json({
        message: 'Internal server error'
    });

});

app.use((_, res) => {

    res.status(404).json({
        message: 'Endpoint not found'
    });

});