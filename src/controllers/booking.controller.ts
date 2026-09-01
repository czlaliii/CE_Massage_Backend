import type { Request, Response } from 'express';
import { BookingService } from '../services/booking.service.js';

const bookingService = new BookingService();

export class BookingController {

    async createBooking(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService.createBooking(
                    req.body
                );

            res.status(201).json(booking);

        } catch (error: any) {

            console.error(error);

            res.status(400).json({
                message: error.message
            });

        }

    }

    async cancelBooking(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService.cancelBooking(
                    req.params.id as string
                );

            res.json(booking);

        } catch (error) {

            res.status(500).json(error);

        }

    }

    async getBookings(
        req: Request,
        res: Response
    ) {

        try {

            const bookings =
                await bookingService.getBookings(
                    req.query.date as string | undefined
                );

            res.json(bookings);

        } catch (error) {

            res.status(500).json(error);

        }

    }

    async getDashboardStats(
        req: Request,
        res: Response
    ) {

        try {

            const month =
                req.query.month
                    ? Number(req.query.month)
                    : new Date().getMonth() + 1;

            const year =
                req.query.year
                    ? Number(req.query.year)
                    : new Date().getFullYear();

            const stats =
                await bookingService.getDashboardStats(
                    year,
                    month
                );

            res.json(stats);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: 'Failed to load dashboard'
            });

        }

    }

    async getAvailableSlots(
        req: Request,
        res: Response
    ) {

        try {

            const date = req.query.date;
            const serviceOptionId = req.query.serviceOptionId;

            if (
                typeof date !== 'string' ||
                typeof serviceOptionId !== 'string'
            ) {
                return res.status(400).json({
                    message: 'Missing parameters'
                });
            }

            const slots =
                await bookingService.getAvailableSlots(
                    date,
                    serviceOptionId
                );

            res.json(slots);

        } catch (error) {

            res.status(500).json(error);

        }

    }

    async getAvailableDates(
        req: Request,
        res: Response
    ) {

        try {

            const dates =
                await bookingService.getAvailableDates(
                    req.query.serviceOptionId as string
                );

            res.json(dates);

        } catch (error) {

            res.status(500).json(error);

        }

    }

    async getBookingByToken(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService.getBookingByToken(
                    req.params.token as string
                );

            res.json(booking);

        } catch (error) {

            res.status(404).json(error);

        }

    }

    async rescheduleBooking(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService.rescheduleBooking(
                    req.params.token as string,
                    req.body.bookingDate,
                    req.body.startTime
                );

            res.json(booking);

        } catch (error) {

            res.status(400).json(error);

        }

    }

    async updateAdminBooking(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService.updateAdminBooking(
                    req.params.id as string,
                    req.body
                );

            res.json(booking);

        } catch (error: any) {

            console.error(error);

            if (
                error.message ===
                'BOOKING_NOT_FOUND'
            ) {

                return res
                    .status(404)
                    .json({
                        message:
                            'A foglalás nem található.'
                    });

            }

            if (
                error.message ===
                'TIME_SLOT_ALREADY_BOOKED'
            ) {

                return res
                    .status(409)
                    .json({
                        message:
                            'Ez az időpont már foglalt.'
                    });

            }

            if (
                error.message ===
                'BLOCKED_TIME_CONFLICT'
            ) {

                return res
                    .status(409)
                    .json({
                        message:
                            'Az időpont egy blokkolt időszakkal ütközik.'
                    });

            }

            res
                .status(500)
                .json({
                    message:
                        'A foglalás módosítása sikertelen.'
                });

        }

    }

    async updateAdminBookingTime(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService.updateAdminBookingTime(
                    req.params.id as string,
                    {
                        booking_date:
                            req.body.booking_date,

                        start_time:
                            req.body.start_time
                    }
                );

            res.json(booking);

        } catch (error: any) {

            console.error(error);

            if (
                error.message ===
                'BOOKING_NOT_FOUND'
            ) {

                return res
                    .status(404)
                    .json({
                        message:
                            'A foglalás nem található.'
                    });

            }

            if (
                error.message ===
                'TIME_SLOT_ALREADY_BOOKED'
            ) {

                return res
                    .status(409)
                    .json({
                        message:
                            'Ez az időpont már foglalt.'
                    });

            }

            if (
                error.message ===
                'BLOCKED_TIME_CONFLICT'
            ) {

                return res
                    .status(409)
                    .json({
                        message:
                            'Az időpont egy blokkolt időszakkal ütközik.'
                    });

            }

            res
                .status(500)
                .json({
                    message:
                        'A foglalás módosítása sikertelen.'
                });

        }

    }

    async createAdminBooking(
        req: Request,
        res: Response
    ) {

        try {

            const booking =
                await bookingService
                    .createAdminBooking(req.body);

            res.status(201).json(
                booking
            );

        } catch (error: any) {

            console.error(error);

            if (
                error.message ===
                'TIME_SLOT_UNAVAILABLE'
            ) {

                return res
                    .status(409)
                    .json({
                        message:
                            'Ez az időpont már foglalt.'
                    });

            }

            res
                .status(500)
                .json({
                    message:
                        'Admin booking creation failed'
                });

        }

    }

}