import { supabase } from '../config/supabase.js';

export class PaymentCleanupService {

    async cleanupExpiredPayments() {

        const cutoffDate =
            new Date(
                Date.now() - 30 * 60 * 1000
            ).toISOString();

        const { data, error } =
            await supabase
                .from('bookings')
                .update({
                    status: 'cancelled'
                })
                .eq(
                    'payment_status',
                    'pending'
                )
                .eq(
                    'status',
                    'pending_payment'
                )
                .lt(
                    'created_at',
                    cutoffDate
                )
                .select();

        if (error) {
            throw error;
        }

        return data;
    }
}