import { supabase } from "../config/supabase.js";
import { EmailService } from "./email.service.js";
import Stripe from 'stripe';
import { InvoiceService } from "./invoice.service.js";

const stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY!
);

export class PaymentService {

    private emailService = new EmailService();
    private invoiceService = new InvoiceService();

    async createPayment(
        booking: any
    ) {

        const session =
            await stripe.checkout.sessions.create({

                mode: 'payment',

                success_url:
                    `${process.env.FRONTEND_URL}/payment-success`,

                cancel_url:
                    `${process.env.FRONTEND_URL}/payment-cancel`,

                metadata: {
                    bookingId:
                        booking.id
                },

                line_items: [
                    {
                        quantity: 1,

                        price_data: {

                            currency: 'huf',

                            product_data: {

                                name:
                                    booking.service_name ??
                                    'CE Massage kezelés'
                            },

                            unit_amount:
                                Math.round(
                                    booking.price * 100
                                )
                        }
                    }
                ]
            });

        return {

            paymentId:
                session.id,

            paymentUrl:
                session.url
        };
    }

    async verifyPayment(
        paymentId: string
    ): Promise<boolean> {

        return true;
    }

    async confirmPayment(
        bookingId: string
    ) {

    console.log(
        'confirmPayment called:',
        bookingId
    );
    const {
        data: existingBooking,
        error: existingBookingError
    } =
        await supabase
            .from('bookings')
            .select(`
                id,
                payment_status,
                status
            `)
            .eq(
                'id',
                bookingId
            )
            .single();

    if (
        existingBookingError ||
        !existingBooking
    ) {
        throw new Error(
            'BOOKING_NOT_FOUND'
        );
    }

        if (
            existingBooking.payment_status === 'paid' ||
            existingBooking.status === 'confirmed'
        ) {

            console.log(
                'Payment already processed:',
                bookingId
            );

            return existingBooking;
        }

        if (
            existingBooking.status ===
            'cancelled'
        ) {

            console.log(
                'Booking already cancelled:',
                bookingId
            );

            return existingBooking;
        }

        const { data, error } =
            await supabase
                .from('bookings')
                .update({

                    payment_status:
                        'paid',

                    status:
                        'confirmed',

                    paid_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    'id',
                    bookingId
                )
                .select(`
                    *,
                    services (
                        name,
                        price
                    )
                `)
                .single();

        if (error || !data) {
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

        try {

            const invoice =
                await this.invoiceService
                    .createInvoice(data);

            await supabase
                .from('bookings')
                .update({

                    invoice_number:
                        invoice.invoiceNumber,

                    invoice_created:
                        true

                })
                .eq(
                    'id',
                    bookingId
                );

        } catch (error) {

            console.error(
                'Invoice creation failed:',
                error
            );

            await supabase
                .from('bookings')
                .update({

                    invoice_error:
                        String(error)

                })
                .eq(
                    'id',
                    bookingId
                );
        }

        return data;
    }
}