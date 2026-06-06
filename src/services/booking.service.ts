import { supabase } from '../config/supabase.js';

export class BookingService {

    async createBooking(body: any) {

        const {
            customer_name,
            customer_email,
            customer_phone,
            service_id,
            booking_date,
            start_time
        } = body;

        const { data: service, error: serviceError } =
            await supabase
                .from('services')
                .select('duration_minutes')
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
                .eq('status', 'confirmed');

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

        const { data, error } =
            await supabase
                .from('bookings')
                .insert({
                    customer_name,
                    customer_email,
                    customer_phone,
                    service_id,
                    booking_date,
                    start_time,
                    end_time
                })
                .select()
                .single();

        if (error) {
            throw error;
        }

        return data;
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
                .eq('status', 'confirmed');

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
}