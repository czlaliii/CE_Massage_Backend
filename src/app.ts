import 'dotenv/config';

import express from 'express';
import { supabase } from './config/supabase.js';
import { BookingService } from './services/booking.service.js';

const app = express();
const bookingService = new BookingService();

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

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started');
});

console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);