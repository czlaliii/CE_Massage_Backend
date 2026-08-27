import { supabase } from '../config/supabase.js';

export class BlockedTimeService {

    async getBlockedTimes() {

        const { data, error } =
            await supabase
                .from('blocked_times')
                .select('*')
                .order('booking_date')
                .order('start_time');

        if (error) {
            throw error;
        }

        return data;
    }


    async createBlockedTime(body: any) {

        const {
            booking_date,
            start_time,
            end_time,
            title
        } = body;

        if (
            !booking_date ||
            !start_time ||
            !end_time
        ) {
            throw new Error(
                'MISSING_BLOCKED_TIME_DATA'
            );
        }

        if (end_time <= start_time) {
            throw new Error(
                'INVALID_BLOCKED_TIME'
            );
        }

        /*
         * Ellenőrizzük, hogy nincs-e már
         * foglalás ebben az időszakban.
         */

        const {
            data: bookings,
            error: bookingError
        } =
            await supabase
                .from('bookings')
                .select(
                    'start_time, end_time'
                )
                .eq(
                    'booking_date',
                    booking_date
                )
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

        const toMinutes = (
            time: string
        ): number => {

            const [
                hours,
                minutes
            ] = time
                .split(':')
                .map(Number);

            return (
                hours! * 60 +
                minutes!
            );
        };

        const startMinutes =
            toMinutes(start_time);

        const endMinutes =
            toMinutes(end_time);

        const hasConflict =
            (bookings ?? []).some(
                booking => {

                    const bookingStart =
                        toMinutes(
                            booking.start_time
                        );

                    const bookingEnd =
                        toMinutes(
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

        if (hasConflict) {
            throw new Error(
                'BLOCKED_TIME_CONFLICT'
            );
        }

        const {
            data,
            error
        } =
            await supabase
                .from('blocked_times')
                .insert({
                    booking_date,
                    start_time,
                    end_time,
                    title:
                        title?.trim()
                        || 'Szabadidő'
                })
                .select()
                .single();

        if (error) {
            throw error;
        }

        return data;
    }


    async updateBlockedTime(
        id: string,
        body: any
    ) {

        const {
            booking_date,
            start_time,
            end_time,
            title
        } = body;

        if (
            !booking_date ||
            !start_time ||
            !end_time
        ) {
            throw new Error(
                'MISSING_BLOCKED_TIME_DATA'
            );
        }

        if (end_time <= start_time) {
            throw new Error(
                'INVALID_BLOCKED_TIME'
            );
        }

        const toMinutes = (
            time: string
        ): number => {

            const [
                hours,
                minutes
            ] = time
                .split(':')
                .map(Number);

            return hours! * 60 + minutes!;
        };

        const startMinutes =
            toMinutes(start_time);

        const endMinutes =
            toMinutes(end_time);


        /*
        * Meglévő foglalások
        */

        const {
            data: bookings,
            error: bookingError
        } =
            await supabase
                .from('bookings')
                .select(
                    'start_time, end_time'
                )
                .eq(
                    'booking_date',
                    booking_date
                )
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


        const bookingConflict =
            (bookings ?? []).some(
                booking => {

                    const bookingStart =
                        toMinutes(
                            booking.start_time
                        );

                    const bookingEnd =
                        toMinutes(
                            booking.end_time
                        );

                    return (
                        startMinutes < bookingEnd &&
                        endMinutes > bookingStart
                    );

                }
            );


        if (bookingConflict) {

            throw new Error(
                'BLOCKED_TIME_CONFLICT'
            );

        }


        /*
        * Másik blokkolással való ütközés
        */

        const {
            data: otherBlocks,
            error: blockError
        } =
            await supabase
                .from('blocked_times')
                .select(
                    'id, start_time, end_time'
                )
                .eq(
                    'booking_date',
                    booking_date
                )
                .neq(
                    'id',
                    id
                );

        if (blockError) {
            throw blockError;
        }


        const blockConflict =
            (otherBlocks ?? []).some(
                block => {

                    const blockStart =
                        toMinutes(
                            block.start_time
                        );

                    const blockEnd =
                        toMinutes(
                            block.end_time
                        );

                    return (
                        startMinutes < blockEnd &&
                        endMinutes > blockStart
                    );

                }
            );


        if (blockConflict) {

            throw new Error(
                'BLOCKED_TIME_OVERLAP'
            );

        }


        /*
        * Frissítés
        */

        const {
            data,
            error
        } =
            await supabase
                .from('blocked_times')
                .update({

                    booking_date,

                    start_time,

                    end_time,

                    title:
                        title?.trim()
                        || 'Szabadidő'

                })
                .eq(
                    'id',
                    id
                )
                .select()
                .single();


        if (error) {
            throw error;
        }


        return data;
    }


    async deleteBlockedTime(
        id: string
    ) {

        const {
            error
        } =
            await supabase
                .from('blocked_times')
                .delete()
                .eq('id', id);

        if (error) {
            throw error;
        }

        return {
            success: true
        };
    }

}