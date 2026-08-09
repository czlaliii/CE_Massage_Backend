import type {
    Request,
    Response
} from 'express';

export class HomeController {

    async index(
        req: Request,
        res: Response
    ) {

        res.send(
            'CE Massage API'
        );

    }

}