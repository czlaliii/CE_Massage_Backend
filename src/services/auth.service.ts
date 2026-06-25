import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export class AuthService {

    async login(
        username: string,
        password: string
    ) {

        const { data: admin, error } =
            await supabase
                .from('admins')
                .select('*')
                .eq('username', username)
                .single();

        console.log('ADMIN:', admin);
        console.log('ERROR:', error);

        if (error || !admin) {
            throw new Error(
                'INVALID_CREDENTIALS'
            );
        }

        const validPassword =
            await bcrypt.compare(
                password,
                admin.password_hash
            );

        console.log('VALID PASSWORD:', validPassword);

        if (!validPassword) {
            throw new Error(
                'INVALID_CREDENTIALS'
            );
        }

        const token = jwt.sign(
            {
                adminId: admin.id,
                username: admin.username
            },
            process.env.JWT_SECRET!,
            {
                expiresIn: '7d'
            }
        );

        return {
            token
        };
    }
}