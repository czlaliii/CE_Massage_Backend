import type {
    Request,
    Response,
    NextFunction
} from 'express';
import jwt from 'jsonwebtoken';

export function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            message: 'Unauthorized'
        });
    }

    try {

        const token =
            authHeader.replace(
                'Bearer ',
                ''
            );

        jwt.verify(
            token,
            process.env.JWT_SECRET!
        );

        next();

    } catch {

        return res.status(401).json({
            message: 'Unauthorized'
        });
    }
}