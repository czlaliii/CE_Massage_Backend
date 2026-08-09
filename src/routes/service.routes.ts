import { Router } from 'express';
import { supabase } from '../config/supabase.js';

const router = Router();

router.get(
    '/services',
    async (_, res) => {

        const { data, error } =
            await supabase
                .from('services')
                .select(`
                    id,
                    name,
                    service_options(
                        id,
                        duration_minutes,
                        price
                    )
                `);

        if (error) {
            return res.status(500).json(error);
        }

        res.json(data);

    }
);

export default router;