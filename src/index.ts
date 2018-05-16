import { Request, Response } from 'express';

export const helloWorld = (_req: Request, res: Response): void => {
    res.type('text/plain').status(200).send('Hello, world!');
};
