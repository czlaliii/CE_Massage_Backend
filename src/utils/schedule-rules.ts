export const MAX_CONTINUOUS_MINUTES = 180;

export const REQUIRED_BREAK_MINUTES = 30;

export interface BookingBlock {

    start_time: string;

    end_time: string;

}

function timeToMinutes(
    time: string
): number {

    const parts = time.split(':');

    const hours =
        Number(parts[0] ?? 0);

    const minutes =
        Number(parts[1] ?? 0);

    return (
        hours * 60 +
        minutes
    );

}

export function respectsBreakRule(

    bookings: BookingBlock[],

    newBooking: BookingBlock

): boolean {

    const allBookings = [

        ...bookings,

        newBooking

    ].sort(

        (a, b) =>

            timeToMinutes(a.start_time) -

            timeToMinutes(b.start_time)

    );

    let blockStart = 0;

    let blockEnd = 0;

    for (let i = 0; i < allBookings.length; i++) {

        const current = allBookings[i];

        if (!current) {
            continue;
        }

        const currentStart =
            timeToMinutes(
                current.start_time
            );

        const currentEnd =
            timeToMinutes(
                current.end_time
            );

        if (i === 0) {

            blockStart = currentStart;

            blockEnd = currentEnd;

            continue;

        }

        const gap =
            currentStart - blockEnd;

        if (gap > 0 && gap >= REQUIRED_BREAK_MINUTES) {

            blockStart = currentStart;

            blockEnd = currentEnd;

            continue;

        }

        const continuousMinutes =
            currentEnd - blockStart;

        if (

            continuousMinutes >

            MAX_CONTINUOUS_MINUTES &&

            i < allBookings.length - 1

        ) {

            return false;

        }

        blockEnd = currentEnd;

    }

    return true;

}