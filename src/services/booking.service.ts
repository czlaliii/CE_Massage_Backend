import { supabase } from '../config/supabase.js';
import { z } from 'zod';
import { EmailService } from './email.service.js';
import { randomUUID } from 'crypto';
import { PaymentService } from './payment.service.js';

export class BookingService {

    private BookingSchema = z.object({
        customer_name: z.string().min(2),
        customer_email: z.string().email(),
        customer_phone: z.string().optional(),

        billing_name: z.string().min(2),
        billing_zip: z.string().min(4),
        billing_city: z.string().min(2),
        billing_address: z.string().min(5),

        service_id: z.string().uuid(),
        booking_date: z.string(),
        start_time: z.string()
    });
    private emailService = new EmailService();
    private paymentService = new PaymentService();

    async createBooking(body: any) {

        this.BookingSchema.parse(body);

        const {
            customer_name,
            customer_email,
            customer_phone,

            billing_name,
            billing_zip,
            billing_city,
            billing_address,

            service_id,
            booking_date,
            start_time
        } = body;

        const { data: service, error: serviceError } =
            await supabase
                .from('services')
                .select(`
                    duration_minutes,
                    name,
                    price
                `)
                .eq('id', service_id)
                .single();

        if (serviceError || !service) {
            throw new Error('Service not found');
        }

        const end_time = this.calculateEndTime(
            start_time,
            service.duration_minutes
        );

        const { data: existingBookings, error: bookingError } =
            await supabase
                .from('bookings')
                .select('*')
                .eq('booking_date', booking_date)
                .in(
                    'status',
                    [
                        'confirmed',
                        'pending_payment'
                    ]
                );

        if (bookingError) {
            throw bookingError;
        }

        const startMinutes =
            this.timeToMinutes(start_time);

        const endMinutes =
            this.timeToMinutes(end_time);

        const hasConflict =
            existingBookings.some(booking => {

                const bookingStart =
                    this.timeToMinutes(
                        booking.start_time
                    );

                const bookingEnd =
                    this.timeToMinutes(
                        booking.end_time
                    );

                return (
                    startMinutes < bookingEnd &&
                    endMinutes > bookingStart
                );
            });

        if (hasConflict) {
            throw new Error(
                'TIME_SLOT_ALREADY_BOOKED'
            );
        }

        const rescheduleToken = randomUUID();
        const { data, error } =
            await supabase
                .from('bookings')
                .insert({
                    customer_name,
                    customer_email,
                    customer_phone,

                    billing_name,
                    billing_zip,
                    billing_city,
                    billing_address,

                    service_id,
                    booking_date,
                    start_time,
                    end_time,

                    reschedule_token:
                        rescheduleToken,

                    status:
                        'pending_payment',

                    payment_status:
                        'pending'
                })
                .select(`
                    *,
                    services (
                        name
                    )
                `)
                .single();

        if (error) {
            throw error;
        }

        const emailData = {

            customer_name:
                data.customer_name,

            customer_email:
                data.customer_email,

            customer_phone:
                data.customer_phone,

            booking_date:
                data.booking_date,

            start_time:
                data.start_time,

            end_time:
                data.end_time,

            service_name:
                data.services?.name,

            reschedule_token:
                data.reschedule_token
        };

        // try {

        //     await this.emailService
        //         .sendAdminNotification(
        //             emailData
        //         );

        // } catch (error) {

        //     console.error(
        //         'Admin email failed:',
        //         error
        //     );
        // }

        // try {

        //     await this.emailService
        //         .sendCustomerConfirmation(
        //             emailData
        //         );

        // } catch (error) {

        //     console.error(
        //         'Customer email failed:',
        //         error
        //     );
        // }

        const payment =
            await this.paymentService
                .createPayment({

                    id: data.id,

                    service_name:
                        service.name,

                    price:
                        service.price
                });

            await supabase
                .from('bookings')
                .update({
                    payment_id:
                        payment.paymentId
                })
                .eq(
                    'id',
                    data.id
                );

        return {

            bookingId:
                data.id,

            paymentId:
                payment.paymentId,

            paymentUrl:
                payment.paymentUrl
        };
    }

    async cancelBooking(bookingId: string) {
        const { data, error } =
            await supabase
                .from('bookings')
                .update({
                    status: 'cancelled'
                })
                .eq('id', bookingId)
                .select(`
                    *,
                    services (
                        name
                    )
                `)
                .single();

        if (error) {
            throw error;
        }

        return data;
    }

    async getBookings(date?: string) {

        let query = supabase
        .from('bookings')
        .select(`
            *,
            services (
                name,
                duration_minutes
            )
        `)
        .eq('status', 'confirmed')
        .order('booking_date')
        .order('start_time');

        if (date) {
            query = query.eq(
                'booking_date',
                date
            );
        }

        const { data, error } =
            await query;

        if (error) {
            throw error;
        }

        return data?.map(booking => ({
            id: booking.id,
            customerName:
                booking.customer_name,
            customerEmail:
                booking.customer_email,
            customerPhone:
                booking.customer_phone,
            date:
                booking.booking_date,
            startTime:
                booking.start_time,
            endTime:
                booking.end_time,
            serviceName:
                booking.services?.name
        }));
    }

    async getBookingByToken(
        token: string
    ) {

        const { data, error } =
            await supabase
                .from('bookings')
                .select(`
                    *,
                    services (
                        name,
                        duration_minutes
                    )
                `)
                .eq(
                    'reschedule_token',
                    token
                )
                .eq(
                    'status',
                    'confirmed'
                )
                .single();

        if (error || !data) {
            throw new Error(
                'BOOKING_NOT_FOUND'
            );
        }

        return {
            id: data.id,
            customerName:
                data.customer_name,
            customerEmail:
                data.customer_email,
            date:
                data.booking_date,
            startTime:
                data.start_time,
            endTime:
                data.end_time,
            serviceId:
                data.service_id,
            serviceName:
                data.services?.name
        };
    }

    async rescheduleBooking(
        token: string,
        bookingDate: string,
        startTime: string
    ) {

        const { data: booking, error } =
            await supabase
                .from('bookings')
                .select(`
                    *,
                    services (
                        duration_minutes
                    )
                `)
                .eq(
                    'reschedule_token',
                    token
                )
                .eq(
                    'status',
                    'confirmed'
                )
                .single();

        if (error || !booking) {
            throw new Error(
                'BOOKING_NOT_FOUND'
            );
        }

        if (
            !this.canReschedule(
                booking.booking_date,
                booking.start_time
            )
        ) {
            throw new Error(
                'RESCHEDULE_PERIOD_EXPIRED'
            );
        }

        const duration =
            booking.services.duration_minutes;

        const endTime =
            this.calculateEndTime(
                startTime,
                duration
            );

        const { data: existingBookings } =
            await supabase
                .from('bookings')
                .select('*')
                .eq(
                    'booking_date',
                    bookingDate
                )
                .in(
                    'status',
                    [
                        'confirmed',
                        'pending_payment'
                    ]
                );

        const startMinutes =
            this.timeToMinutes(
                startTime
            );

        const endMinutes =
            this.timeToMinutes(
                endTime
            );

        const hasConflict =
            existingBookings?.some(
                existingBooking => {

                    if (
                        existingBooking.id ===
                        booking.id
                    ) {
                        return false;
                    }

                    const bookingStart =
                        this.timeToMinutes(
                            existingBooking.start_time
                        );

                    const bookingEnd =
                        this.timeToMinutes(
                            existingBooking.end_time
                        );

                    return (
                        startMinutes <
                            bookingEnd &&
                        endMinutes >
                            bookingStart
                    );
                }
            );

        if (hasConflict) {
            throw new Error(
                'TIME_SLOT_ALREADY_BOOKED'
            );
        }

        const { data: updatedBooking } =
            await supabase
                .from('bookings')
                .update({
                    booking_date:
                        bookingDate,

                    start_time:
                        startTime,

                    end_time:
                        endTime
                })
                .eq(
                    'id',
                    booking.id
                )
                .select(`
                    *,
                    services (
                        name
                    )
                `)
                .single();

                try {

                    await this.emailService
                        .sendRescheduleConfirmation({

                            customer_name:
                                updatedBooking.customer_name,

                            customer_email:
                                updatedBooking.customer_email,

                            booking_date:
                                updatedBooking.booking_date,

                            start_time:
                                updatedBooking.start_time,

                            end_time:
                                updatedBooking.end_time,

                            service_name:
                                updatedBooking.services?.name,
                            
                            reschedule_token:
                                updatedBooking.reschedule_token
                        });

                } catch (error) {

                    console.error(
                        'Reschedule email failed:',
                        error
                    );
                }

        return updatedBooking;
    }

    async getDashboardStats() {

        const today =
            new Date()
                .toISOString()
                .split('T')[0]!;

        const firstDayOfMonth =
            new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1
            )
            .toISOString()
            .split('T')[0]!;

        const { data, error } =
            await supabase
                .from('bookings')
                .select(`
                    *,
                    services (
                        price
                    )
                `)
                .eq(
                    'payment_status',
                    'paid'
                );

        if (error) {
            throw error;
        }

        const todayBookings =
            data.filter(
                booking =>
                    booking.booking_date ===
                    today
            );

        const monthBookings =
            data.filter(
                booking =>
                    booking.booking_date >=
                    firstDayOfMonth
            );

        const revenueByDay: {
            date: string;
            revenue: number;
        }[] = [];

        for (let i = 6; i >= 0; i--) {

            const date = new Date();

            date.setDate(
                date.getDate() - i
            );

            const dateString =
                date
                    .toISOString()
                    .split('T')[0]!;

            const dayRevenue =
                data
                    .filter(
                        booking =>
                            booking.booking_date ===
                            dateString
                    )
                    .reduce(
                        (sum, booking) =>
                            sum +
                            (
                                booking.services?.price ??
                                0
                            ),
                        0
                    );

            revenueByDay.push({
                date: dateString,
                revenue: dayRevenue
            });
        }

        const todayRevenue =
            todayBookings.reduce(
                (sum, booking) =>
                    sum +
                    (
                        booking.services?.price ??
                        0
                    ),
                0
            );

        const monthRevenue =
            monthBookings.reduce(
                (sum, booking) =>
                    sum +
                    (
                        booking.services?.price ??
                        0
                    ),
                0
            );

        return {
            todayBookings:
                todayBookings.length,

            todayRevenue:
                todayRevenue,

            monthBookings:
                monthBookings.length,

            monthRevenue:
                monthRevenue,

            revenueByDay
        };
    }

    async getAvailableSlots(
        bookingDate: string,
        serviceId: string
    ) {

        const { data: service, error: serviceError } =
            await supabase
                .from('services')
                .select('duration_minutes')
                .eq('id', serviceId)
                .single();

        if (serviceError || !service) {
            throw new Error('Service not found');
        }

        const duration =
            service.duration_minutes;

        const { data: bookings, error } =
            await supabase
                .from('bookings')
                .select('*')
                .eq('booking_date', bookingDate)
                .in(
                    'status',
                    [
                        'confirmed',
                        'pending_payment'
                    ]
                );

        if (error) {
            throw error;
        }

        const slots: string[] = [];

        const openingTime = 9 * 60;
        const closingTime = 18 * 60;

        let minutes = openingTime;

        while (
            minutes + duration <= closingTime
        ) {

            const start =
                this.minutesToTime(minutes);

            const end =
                this.minutesToTime(
                    minutes + duration
                );

            const startMinutes =
                this.timeToMinutes(start);

            const endMinutes =
                this.timeToMinutes(end);

            const conflict =
                bookings.some(booking => {

                    const bookingStart =
                        this.timeToMinutes(
                            booking.start_time
                        );

                    const bookingEnd =
                        this.timeToMinutes(
                            booking.end_time
                        );

                    return (
                        startMinutes < bookingEnd &&
                        endMinutes > bookingStart
                    );
                });

            if (!conflict) {
                slots.push(start);
            }

            minutes += 30;
        }

        return slots;
    }

    private calculateEndTime(
        startTime: string,
        durationMinutes: number
    ): string {

        const [
            hours = '0',
            minutes = '0'
        ] = startTime.split(':');

        const date = new Date();

        date.setHours(Number(hours));
        date.setMinutes(
            Number(minutes) + durationMinutes
        );

        return date
            .toTimeString()
            .slice(0, 5);
    }

    private minutesToTime(
        minutes: number
    ): string {

        const hours =
            Math.floor(minutes / 60);

        const mins =
            minutes % 60;

        return `${hours
            .toString()
            .padStart(2, '0')}:${mins
            .toString()
            .padStart(2, '0')}`;
    }

    private timeToMinutes(
        time: string
    ): number {

        const [hours = '0', minutes = '0'] =
            time.split(':');

        return (
            Number(hours) * 60 +
            Number(minutes)
        );
    }

    private canReschedule(
        bookingDate: string,
        startTime: string
    ): boolean {

        const bookingDateTime =
            new Date(
                `${bookingDate}T${startTime}`
            );

        const now =
            new Date();

        const diffHours =
            (
                bookingDateTime.getTime() -
                now.getTime()
            ) /
            (1000 * 60 * 60);

        return diffHours >= 24;
    }
}