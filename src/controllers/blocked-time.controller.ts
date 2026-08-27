import type {
    Request,
    Response
} from 'express';

import {
    BlockedTimeService
} from '../services/blocked-time.service.js';


const blockedTimeService =
    new BlockedTimeService();


export class BlockedTimeController {

    async getBlockedTimes(
        _req: Request,
        res: Response
    ) {

        try {

            const data =
                await blockedTimeService
                    .getBlockedTimes();

            res.json(data);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    'Failed to load blocked times'
            });

        }

    }


    async createBlockedTime(
        req: Request,
        res: Response
    ) {

        try {

            const data =
                await blockedTimeService
                    .createBlockedTime(
                        req.body
                    );

            res.status(201).json(data);

        } catch (error: any) {

            console.error(error);

            if (
                error.message ===
                'BLOCKED_TIME_CONFLICT'
            ) {

                res.status(409).json({
                    message:
                        'A megadott időszak ütközik egy meglévő foglalással.'
                });

                return;
            }

            if (
                error.message ===
                'INVALID_BLOCKED_TIME'
            ) {

                res.status(400).json({
                    message:
                        'A befejezési időnek későbbinek kell lennie a kezdési időnél.'
                });

                return;
            }

            res.status(500).json({
                message:
                    'Failed to create blocked time'
            });

        }

    }


    async updateBlockedTime(
        req: Request,
        res: Response
    ) {

        try {

            const id = req.params.id;

            if (typeof id !== 'string') {

                res.status(400).json({
                    message:
                        'Invalid blocked time ID'
                });

                return;
            }

            const data =
                await blockedTimeService
                    .updateBlockedTime(
                        id,
                        req.body
                    );

            res.json(data);

       } catch (error: any) {

            console.error(error);


            if (
                error.message ===
                'BLOCKED_TIME_CONFLICT'
            ) {

                res.status(409).json({

                    message:
                        'A megadott időszak ütközik egy meglévő foglalással.'

                });

                return;
            }


            if (
                error.message ===
                'BLOCKED_TIME_OVERLAP'
            ) {

                res.status(409).json({

                    message:
                        'A megadott időszak ütközik egy másik szabadidő sávval.'

                });

                return;
            }


            if (
                error.message ===
                'INVALID_BLOCKED_TIME'
            ) {

                res.status(400).json({

                    message:
                        'A befejezési időnek későbbinek kell lennie a kezdési időnél.'

                });

                return;
            }


            res.status(500).json({

                message:
                    'Failed to update blocked time'

            });

        }
    }


    async deleteBlockedTime(
        req: Request,
        res: Response
    ) {

        try {

            const id = req.params.id;

            if (typeof id !== 'string') {

                res.status(400).json({
                    message:
                        'Invalid blocked time ID'
                });

                return;
            }

            await blockedTimeService
                .deleteBlockedTime(id);

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    'Failed to delete blocked time'
            });

        }
    }

}