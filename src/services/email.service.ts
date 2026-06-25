import { Resend } from 'resend';
import { createEvent } from 'ics';

const resend =
    new Resend(
        process.env.RESEND_API_KEY
    );

export class EmailService {

    async sendAdminNotification(
        booking: any
    ) {
        console.log(
            'RESEND KEY EXISTS:',
            !!process.env.RESEND_API_KEY
        );

        console.log(
            'ADMIN EMAIL:',
            process.env.ADMIN_EMAIL
        );

        const result = await resend.emails.send({

        from:
            'CE Massage <foglalas@mail.cemassage.hu>',

        to:
            process.env.ADMIN_EMAIL!,

        subject:
            'Új foglalás érkezett',

        html: `
            <h2>Új foglalás érkezett</h2>

            <p>
                <strong>Név:</strong>
                ${booking.customer_name}
            </p>

            <p>
                <strong>Email:</strong>
                ${booking.customer_email}
            </p>

            <p>
                <strong>Telefon:</strong>
                ${booking.customer_phone ?? '-'}
            </p>

            <p>
                <strong>Szolgáltatás:</strong>
                ${booking.service_name}
            </p>

            <p>
                <strong>Dátum:</strong>
                ${booking.booking_date}
            </p>

            <p>
                <strong>Időpont:</strong>
                ${booking.start_time} - ${booking.end_time}
            </p>
        `
        });
        console.log(
            'Resend result:',
            result
        );
    }

    async sendCustomerConfirmation(
        booking: any
    ) {
        const rescheduleUrl =
            `https://cemassage.hu/reschedule/${booking.reschedule_token}`;

        const calendarAttachment =
            this.createCalendarAttachment(
                booking
            );

        const { data, error } =
            await resend.emails.send({
                from:
                    'CE Massage <noreply@mail.cemassage.hu>',

                to:
                    booking.customer_email,

                subject:
                    'Foglalás visszaigazolása',
                
                attachments: [
                    calendarAttachment
                ],

                html: `
                    <div style="
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                        line-height: 1.6;
                    ">

                        <h2>
                            Kedves ${booking.customer_name}!
                        </h2>

                        <p>
                            Köszönjük foglalását.
                        </p>

                        <p>
                            Az időpontot sikeresen rögzítettük.
                        </p>

                        <hr>

                        <p>
                            <strong>Szolgáltatás:</strong>
                            ${booking.service_name}
                        </p>

                        <p>
                            <strong>Dátum:</strong>
                            ${booking.booking_date}
                        </p>

                        <p>
                            <strong>Időpont:</strong>
                            ${booking.start_time}
                            -
                            ${booking.end_time}
                        </p>

                        <hr>

                        <p>
                            Ha módosítani szeretnéd az időpontodat,
                            a kezelés kezdete előtt legalább
                            24 órával ezt az alábbi gombbal teheted meg.
                        </p>

                        <p>
                            24 órán belül az időpont már nem módosítható.
                        </p>

                        <a
                            href="${rescheduleUrl}"
                            style="
                                display:inline-block;
                                padding:12px 20px;
                                background:#d4af37;
                                color:white;
                                text-decoration:none;
                                border-radius:8px;
                                margin-top:10px;
                            "
                        >
                            Időpont módosítása
                        </a>

                        <hr>
                        <p>
                            Szeretettel várlak:
                        </p>

                        <p>
                            <strong>Czinege Edina</strong><br>
                            CE Massage
                        </p>

                    </div>
                `
            });

        console.log(
            'Customer email:',
            data,
            error
        );
    }

    async sendRescheduleConfirmation(
        booking: any
    ) {       
        const calendarAttachment =
            this.createCalendarAttachment(
                booking
            );

        const { data, error } =
            await resend.emails.send({

                from:
                    'CE Massage <noreply@mail.cemassage.hu>',

                to:
                    booking.customer_email,

                subject:
                    'Időpont módosítás visszaigazolása',

                attachments: [
                    calendarAttachment
                ],

                html: `
                    <div style="
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                        line-height: 1.6;
                    ">

                        <h2>
                            Kedves ${booking.customer_name}!
                        </h2>

                        <p>
                            Az időpontodat sikeresen módosítottuk.
                        </p>

                        <hr>

                        <p>
                            <strong>Szolgáltatás:</strong>
                            ${booking.service_name}
                        </p>

                        <p>
                            <strong>Új dátum:</strong>
                            ${booking.booking_date}
                        </p>

                        <p>
                            <strong>Új időpont:</strong>
                            ${booking.start_time}
                            -
                            ${booking.end_time}
                        </p>

                        <hr>

                        <p>
                            Szeretettel várlak:
                        </p>

                        <p>
                            <strong>Czinege Edina</strong><br>
                            CE Massage
                        </p>

                    </div>
                `
            });

        console.log(
            'Reschedule email:',
            data,
            error
        );
    }

    private createCalendarAttachment(
        booking: any
    ) {

        const startDate =
            booking.booking_date
                .split('-')
                .map(Number);

        const startTime =
            booking.start_time
                .split(':')
                .map(Number);

        const endTime =
            booking.end_time
                .split(':')
                .map(Number);

        const { error, value } =
            createEvent({

                title:
                    booking.service_name,

                description:
                    `
                    CE Massage

                    Szolgáltatás:
                    ${booking.service_name}

                    Vendég:
                    ${booking.customer_name}

                    Telefonszám:
                    +36 30 346 2492

                    Weboldal:
                    https://cemassage.hu

                    Átfoglalás:
                    https://cemassage.hu/reschedule/${booking.reschedule_token}
                    `,

                location:
                    'Budapest 1067, Hajós utca 13.',

                organizer: {
                    name:
                        'CE Massage',

                    email:
                        'czinege.edina@gmail.com'
                },

                start: [
                    startDate[0],
                    startDate[1],
                    startDate[2],
                    startTime[0],
                    startTime[1]
                ],

                end: [
                    startDate[0],
                    startDate[1],
                    startDate[2],
                    endTime[0],
                    endTime[1]
                ],

                status:
                    'CONFIRMED',

                busyStatus:
                    'BUSY'
            });

        if (error) {
            throw error;
        }

        return {
            filename: 'CE-Massage.ics',

            content:
                Buffer
                    .from(value!)
                    .toString('base64')
        };
    }
}