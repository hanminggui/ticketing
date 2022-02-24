import { Request, Response, Handler, NextFunction } from 'express';
import bodyParser from 'body-parser';
import timeout from 'connect-timeout';

const jsonParser = bodyParser.json();

const haltOnTimedout = (req: Request, res: Response, next: NextFunction) => {
  if (!req.timedout) next();
};

export const globalMiddles: Handler[] = [jsonParser, timeout('5s'), haltOnTimedout];
