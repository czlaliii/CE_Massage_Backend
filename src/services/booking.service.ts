import { supabase } from '../config/supabase.js';
import { z } from 'zod';
import { EmailService } from './email.service.js';
import { randomUUID } from 'crypto';
// import { PaymentService } from './payment.service.js';
import {
    respectsBreakRule
} from '../utils/schedule-rules.js';

export class BookingService {

    private BookingSchema = z.object({
        customer_name: z.string().min(2),
        customer_email: z.string().email(),
        customer_phone: z.string().optional(),

        // billing_name: z.string().min(2),
        // billing_zip: z.string().min(4),
        // billing_city: z.string().min(2),
        // billing_address: z.string().min(5),

        service_option_id: z.string().uuid(),
        booking_date: z.string().date(),
        start_time: z.string()
    });
    private emailService = new EmailService();
    // private paymentService = new PaymentService();

    async createBooking(body: any) {

        this.BookingSchema.parse(body);

        return this.createBookingInternal(
            body,
            {
                sendAdminEmail: true,
                sendCustomerEmail: true
            }
        );
    }

    async createAdminBooking(body: any) {

        this.BookingSchema.parse(body);

        return this.createBookingInternal(
            body,
            {
                sendAdminEmail: false,
                sendCustomerEmail:
                    body.send_confirmation_email !== false
            }
        );
    }


    private async createBookingInternal(
    body: any,
        options: {
            sendAdminEmail: boolean;
            sendCustomerEmail: boolean;
        }
    ) {

        const {
            customer_name,
            customer_email,
            customer_phone,

            service_option_id,
            booking_date,
            start_time
        } = body;

        const now = new Date();

        const today =
            now.toISOString().split('T')[0]!;

        const tomorrow = new Date(now);

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        const tomorrowString =
            tomorrow.toISOString().split('T')[0]!;

        const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();

        const bookingMinutes =
            this.timeToMinutes(start_time);

        // Mai foglalás
        if (booking_date === today) {

            if (
                bookingMinutes <
                currentMinutes + 60
            ) {

                throw new Error(
                    'TIME_SLOT_ALREADY_PASSED'
                );

            }

        }

        // Holnapi foglalás
        if (booking_date === tomorrowString) {

            if (
                (
                    currentMinutes >= 20 * 60 ||
                    currentMinutes < 8 * 60
                ) &&
                bookingMinutes < 11 * 60
            ) {

                throw new Error(
                    'NEXT_DAY_MORNING_NOT_AVAILABLE'
                );

            }

        }

        const {
            data: serviceOption,
            error: serviceError
        } =
            await supabase
                .from('service_options')
                .select(`
                    duration_minutes,
                    price,
                    services (
                        name
                    )
                `)
                .eq(
                    'id',
                    service_option_id
                )
                .single();

        if (
            serviceError ||
            !serviceOption
        ) {
            throw new Error(
                'Service not found'
            );
        }

        const end_time = this.calculateEndTime(
            start_time,
            serviceOption.duration_minutes
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
            (existingBookings ?? []).some(booking => {

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

        const breakRuleOk =
            respectsBreakRule(
                existingBookings ?? [],
                {
                    start_time: start_time,
                    end_time: end_time
                }
            );

        if (!breakRuleOk) {

            throw new Error(
                'BREAK_REQUIRED'
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

                    // billing_name,
                    // billing_zip,
                    // billing_city,
                    // billing_address,

                    service_option_id,
                    booking_date,
                    start_time,
                    end_time,

                    reschedule_token:
                        rescheduleToken,

                    status:
                        'confirmed',

                    payment_status:
                        'pending'
                })
                .select(`
                    *,
                    service_options (
                        duration_minutes,
                        price,
                        services (
                            name
                        )
                    )
                `)
                .single();

        if (error) {
            throw error;
        }

        const service =
            Array.isArray(data.service_options?.services)
                ? data.service_options.services[0]
                : data.service_options?.services;

        const serviceName = service?.name;

        // const payment =
        //     await this.paymentService.createPayment({

        //         id: data.id,

        //         service_name:
        //             serviceName,

        //         duration_minutes:
        //             serviceOption.duration_minutes,

        //         price:
        //             serviceOption.price
        //     });

        //     await supabase
        //         .from('bookings')
        //         .update({
        //             payment_id:
        //                 payment.paymentId
        //         })
        //         .eq(
        //             'id',
        //             data.id
        //         );

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
                serviceName,

            reschedule_token:
                data.reschedule_token
        };

        if (options.sendAdminEmail) {

            try {

                await this.emailService
                    .sendAdminNotification(
                        emailData
                    );

            } catch (error) {

                console.error(
                    'Admin email failed:',
                    error
                );
            }
        }

        if (options.sendCustomerEmail) {

            try {

                await this.emailService
                    .sendCustomerConfirmation(
                        emailData
                    );

            } catch (error) {

                console.error(
                    'Customer email failed:',
                    error
                );
            }
        }

        return {

            bookingId:
                data.id,

            // paymentId:
            //     payment.paymentId,

            // paymentUrl:
            //     payment.paymentUrl
        };
    }

    async cancelBooking(bookingId: string) {
        const { data, error } =
            await supabase
                .from('bookings')
                .update({
                    status: 'cancelled',
                    payment_status: 'cancelled'
                })
                .eq('id', bookingId)
                .select(`
                    *,
                    service_options (
                        services (
                            name
                        )
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
            service_options (
                duration_minutes,
                price,
                services (
                    name
                )
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
                booking.service_options?.services?.name
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
                    service_options (
                        duration_minutes,
                        price,
                        services (
                            name
                        )
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
            serviceOptionId:
                data.service_option_id,
            serviceName:
                data.service_options?.services?.name
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
                    service_options (
                        duration_minutes,
                        services (
                            name
                        )
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
            booking.service_options?.duration_minutes;

        const now = new Date();

        const today =
            now.toISOString().split('T')[0];

        if (bookingDate === today) {

            const currentMinutes =
                now.getHours() * 60 +
                now.getMinutes() + 60;

            const bookingMinutes =
                this.timeToMinutes(startTime);

            if (bookingMinutes <= currentMinutes) {
                throw new Error(
                    'TIME_SLOT_ALREADY_PASSED'
                );
            }
        }

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
            (existingBookings ?? []).some(
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

        const breakRuleOk =
            respectsBreakRule(

                (existingBookings ?? []).filter(
                    existingBooking =>
                        existingBooking.id !==
                        booking.id
                ),

                {
                    start_time: startTime,
                    end_time: endTime
                }

            );

        if (!breakRuleOk) {

            throw new Error(
                'BREAK_REQUIRED'
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
                    service_options (
                        services (
                            name
                        )
                    )
                `)
                .single();

                const service =
                    Array.isArray(updatedBooking.service_options?.services)
                        ? updatedBooking.service_options.services[0]
                        : updatedBooking.service_options?.services;

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
                                service?.name,
                            
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

    async getDashboardStats(year: number, month: number) {

        const now = new Date();

        const today =
            new Date()
                .toISOString()
                .split('T')[0]!;

        const firstDayOfMonth =
            new Date(
                year,
                month - 1,
                1
            )
                .toISOString()
                .split('T')[0]!;

        const lastDayOfMonth =
            new Date(
                year,
                month,
                0
            )
                .toISOString()
                .split('T')[0]!;

        const firstDayOfYear =
            new Date(
                year,
                0,
                1
            )
                .toISOString()
                .split('T')[0]!;

        const lastDayOfYear =
            new Date(
                year,
                11,
                31
            )
                .toISOString()
                .split('T')[0]!;

        const { data, error } =
            await supabase
                .from('bookings')
                .select(`
                    *,
                    service_options (
                        price
                    )
                `)
                .eq('status', 'confirmed');

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
                    booking.booking_date >= firstDayOfMonth &&
                    booking.booking_date <= lastDayOfMonth
            );

        const yearBookings =
            data.filter(
                booking =>
                    booking.booking_date >= firstDayOfYear &&
                    booking.booking_date <= lastDayOfYear
            );

        const totalBookings =
            data.length;

        const totalRevenue =
            data.reduce(
                (sum, booking) =>
                    sum +
                    (
                        booking.service_options?.price ??
                        0
                    ),
                0
            );

        const yearRevenue =
            yearBookings.reduce(
                (sum, booking) =>
                    sum +
                    (
                        booking.service_options?.price ??
                        0
                    ),
                0
            );

        const bookingsByDay: {
            date: string;
            bookings: number;
        }[] = [];

        for (let i = 6; i >= 0; i--) {

            const date = new Date();
            date.setDate(date.getDate() - i);

            const dateString =
                date.toISOString().split('T')[0]!;

            const dayBookings =
                data.filter(
                    booking =>
                        booking.booking_date === dateString
                );

            bookingsByDay.push({

                date: dateString,

                bookings: dayBookings.length

            });

        }

        const todayRevenue =
            todayBookings.reduce(
                (sum, booking) =>
                    sum +
                    (
                        booking.service_options?.price ??
                        0
                    ),
                0
            );

        const monthRevenue =
            monthBookings.reduce(
                (sum, booking) =>
                    sum +
                    (
                        booking.service_options?.price ??
                        0
                    ),
                0
            );

        return {

            todayBookings:
                todayBookings.length,

            todayRevenue,

            monthBookings:
                monthBookings.length,

            monthRevenue,

            yearBookings:
                yearBookings.length,

            yearRevenue,

            totalBookings,

            totalRevenue,

            bookingsByDay
        };
    }

    async getAvailableDates(
        serviceOptionId: string
    ) {

        // 1. Szolgáltatás időtartamának lekérése
        const {
            data: service,
            error: serviceError
        } = await supabase
            .from('service_options')
            .select('duration_minutes')
            .eq('id', serviceOptionId)
            .single();

        if (serviceError || !service) {
            throw new Error('Service not found');
        }

        const duration =
            service.duration_minutes;


        // 2. Következő 90 nap meghatározása

        const today = new Date();

        const dates: string[] = [];

        for (let i = 0; i < 90; i++) {

            const date = new Date(today);

            date.setDate(
                today.getDate() + i
            );

            const dateString =
                date
                    .toISOString()
                    .split('T')[0]!;

            dates.push(dateString);
        }

        const firstDate =
            dates[0]!;

        const lastDate =
            dates[dates.length - 1]!;


        // 3. ÖSSZES foglalás lekérése egyetlen queryvel

        const {
            data: bookings,
            error: bookingsError
        } = await supabase
            .from('bookings')
            .select(`
                booking_date,
                start_time,
                end_time,
                status
            `)
            .gte(
                'booking_date',
                firstDate
            )
            .lte(
                'booking_date',
                lastDate
            )
            .in(
                'status',
                [
                    'confirmed',
                    'pending_payment'
                ]
            )
            .order(
                'booking_date'
            )
            .order(
                'start_time'
            );

        if (bookingsError) {
            throw bookingsError;
        }


        // 4. Foglalások csoportosítása dátum szerint

        const bookingsByDate =
            new Map<string, any[]>();

        for (const booking of bookings ?? []) {

            const date =
                booking.booking_date;

            if (!bookingsByDate.has(date)) {

                bookingsByDate.set(
                    date,
                    []
                );

            }

            bookingsByDate
                .get(date)!
                .push(booking);
        }


        // 5. Mai / holnapi időszabályok

        const now = new Date();

        const todayString =
            now
                .toISOString()
                .split('T')[0]!;

        const tomorrow =
            new Date(now);

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        const tomorrowString =
            tomorrow
                .toISOString()
                .split('T')[0]!;

        const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();


        // 6. Elérhető dátumok kiszámítása

        const availableDates: string[] = [];

        const openingTime = 8 * 60;
        const closingTime = 20 * 60;

        for (const dateString of dates) {

            const bookingsForDate =
                bookingsByDate.get(
                    dateString
                ) ?? [];


            let earliestMinutes =
                openingTime;


            // Mai nap:
            // legalább 60 perccel későbbi időpont

            if (
                dateString ===
                todayString
            ) {

                earliestMinutes =
                    currentMinutes + 60;
            }


            // Holnapi nap:
            // ha már este van / még túl korán van,
            // akkor csak 11:00-tól

            else if (
                dateString ===
                tomorrowString
            ) {

                if (
                    currentMinutes >= 20 * 60 ||
                    currentMinutes < 8 * 60
                ) {

                    earliestMinutes =
                        11 * 60;
                }
            }


            let minutes =
                openingTime;

            let hasAvailableSlot =
                false;


            while (
                minutes + duration <=
                closingTime
            ) {

                const start =
                    this.minutesToTime(
                        minutes
                    );

                const end =
                    this.minutesToTime(
                        minutes + duration
                    );

                const startMinutes =
                    this.timeToMinutes(
                        start
                    );

                const endMinutes =
                    this.timeToMinutes(
                        end
                    );


                // Foglalási ütközés

                const conflict =
                    bookingsForDate.some(
                        booking => {

                            const bookingStart =
                                this.timeToMinutes(
                                    booking.start_time
                                );

                            const bookingEnd =
                                this.timeToMinutes(
                                    booking.end_time
                                );

                            return (
                                startMinutes <
                                bookingEnd &&
                                endMinutes >
                                bookingStart
                            );
                        }
                    );


                // Szünet szabály

                const breakRuleOk =
                    respectsBreakRule(
                        bookingsForDate,
                        {
                            start_time:
                                start,

                            end_time:
                                end
                        }
                    );


                if (
                    !conflict &&
                    startMinutes >=
                        earliestMinutes &&
                    breakRuleOk
                ) {

                    hasAvailableSlot =
                        true;

                    break;
                }


                minutes += 30;
            }


            if (hasAvailableSlot) {

                availableDates.push(
                    dateString
                );
            }
        }


        return availableDates;
    }


    async getAvailableSlots(
        bookingDate: string,
        serviceOptionId: string
    ) {

        // 1. Szolgáltatás időtartama

        const {
            data: service,
            error: serviceError
        } = await supabase
            .from('service_options')
            .select(
                'duration_minutes'
            )
            .eq(
                'id',
                serviceOptionId
            )
            .single();

        if (
            serviceError ||
            !service
        ) {

            throw new Error(
                'Service not found'
            );
        }

        const duration =
            service.duration_minutes;


        // 2. Az adott nap foglalásai

        const {
            data: bookings,
            error
        } = await supabase
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
            )
            .order(
                'start_time'
            );

        if (error) {
            throw error;
        }


        const slots: string[] = [];


        // 3. Nyitvatartás

        const openingTime =
            8 * 60;

        const closingTime =
            20 * 60;


        let minutes =
            openingTime;


        // 4. Aktuális idő

        const now =
            new Date();

        const today =
            now
                .toISOString()
                .split('T')[0]!;


        const tomorrow =
            new Date(now);

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        const tomorrowString =
            tomorrow
                .toISOString()
                .split('T')[0]!;


        const currentMinutes =
            now.getHours() * 60 +
            now.getMinutes();


        let earliestMinutes =
            openingTime;


        // 5. Mai nap

        if (
            bookingDate ===
            today
        ) {

            earliestMinutes =
                currentMinutes + 60;
        }


        // 6. Holnapi nap

        else if (
            bookingDate ===
            tomorrowString
        ) {

            if (
                currentMinutes >=
                    20 * 60 ||
                currentMinutes <
                    8 * 60
            ) {

                earliestMinutes =
                    11 * 60;
            }
        }


        // 7. Szabad időpontok keresése

        while (
            minutes + duration <=
            closingTime
        ) {

            const start =
                this.minutesToTime(
                    minutes
                );

            const end =
                this.minutesToTime(
                    minutes + duration
                );


            const startMinutes =
                this.timeToMinutes(
                    start
                );

            const endMinutes =
                this.timeToMinutes(
                    end
                );


            // Foglalási ütközés

            const conflict =
                (bookings ?? []).some(
                    booking => {

                        const bookingStart =
                            this.timeToMinutes(
                                booking.start_time
                            );

                        const bookingEnd =
                            this.timeToMinutes(
                                booking.end_time
                            );

                        return (
                            startMinutes <
                            bookingEnd &&
                            endMinutes >
                            bookingStart
                        );
                    }
                );


            // Szünet szabály

            const breakRuleOk =
                respectsBreakRule(
                    bookings ?? [],
                    {
                        start_time:
                            start,

                        end_time:
                            end
                    }
                );


            if (
                !conflict &&
                startMinutes >=
                    earliestMinutes &&
                breakRuleOk
            ) {

                slots.push(
                    start
                );
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