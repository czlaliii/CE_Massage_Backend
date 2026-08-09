import type {
    Request,
    Response
} from 'express';

import jwt from 'jsonwebtoken';

export class AuthController {

    async login(
        req: Request,
        res: Response
    ) {

        const {
            username,
            password
        } = req.body;

        if (
            username !== process.env.ADMIN_USERNAME ||
            password !== process.env.ADMIN_PASSWORD
        ) {

        console.log('Body:', req.body);

        console.log('Expected username:', process.env.ADMIN_USERNAME);
        console.log('Received username:', username);

        console.log('Expected password:', process.env.ADMIN_PASSWORD);
        console.log('Received password:', password);

            return res
                .status(401)
                .json({
                    message:
                        'Invalid credentials'
                });

        }

        const token =
            jwt.sign(
                {
                    admin: true
                },
                process.env.JWT_SECRET!,
                {
                    expiresIn: '7d'
                }
            );

        res.json({
            token
        });

    }

}