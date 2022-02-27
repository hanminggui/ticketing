import { Request, Response, Handler, NextFunction } from 'express';
import { validationResult } from 'express-validator';

import bodyParser from 'body-parser';
import timeout from 'connect-timeout';
import { fail } from './response';

const jsonParser = bodyParser.json();

const haltOnTimedout = (req: Request, _: Response, next: NextFunction) => {
  if (!req.timedout) next();
};

export const validateParams = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.json(fail(400, Error('params error'), errors.array()));
    return;
  }
  next();
};

export const globalMiddles: Handler[] = [jsonParser, timeout('5s'), haltOnTimedout];
