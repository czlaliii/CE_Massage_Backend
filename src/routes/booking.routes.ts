import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new BookingController();

router.get(
    '/slots',
    (req, res) =>
        controller.getAvailableSlots(req, res)
);

router.get(
    '/availability',
    (req, res) =>
        controller.getAvailableDates(req, res)
);

router.post(
    '/bookings',
    (req, res) =>
        controller.createBooking(req, res)
);

router.get(
    '/bookings',
    authMiddleware,
    (req, res) =>
        controller.getBookings(req, res)
);

router.delete(
    '/bookings/:id',
    authMiddleware,
    (req, res) =>
        controller.cancelBooking(req, res)
);

router.get(
    '/bookings/reschedule/:token',
    (req, res) =>
        controller.getBookingByToken(req, res)
);

router.post(
    '/bookings/reschedule/:token',
    (req, res) =>
        controller.rescheduleBooking(req, res)
);

router.get(
    '/admin/dashboard',
    authMiddleware,
    (req, res) =>
        controller.getDashboardStats(req, res)
);

export default router;