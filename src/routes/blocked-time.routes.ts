import {
    Router
} from 'express';

import {
    BlockedTimeController
} from '../controllers/blocked-time.controller.js';


const router = Router();

const controller =
    new BlockedTimeController();


router.get(
    '/admin/blocked-times',
    (req, res) =>
        controller.getBlockedTimes(
            req,
            res
        )
);


router.post(
    '/admin/blocked-times',
    (req, res) =>
        controller.createBlockedTime(
            req,
            res
        )
);


router.put(
    '/admin/blocked-times/:id',
    (req, res) =>
        controller.updateBlockedTime(
            req,
            res
        )
);


router.delete(
    '/admin/blocked-times/:id',
    (req, res) =>
        controller.deleteBlockedTime(
            req,
            res
        )
);


export default router;