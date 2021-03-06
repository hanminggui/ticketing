import { Request, Response, Handler } from 'express';
import Router from 'express-promise-router';
import { body, check, validationResult } from 'express-validator';
import { globalMiddles, validateParams } from './middleware';
import { success, fail } from './response';

import { TicketService } from '../services/ticketService';
import { FakeAirlineService } from '../services/airlineService';
import { FakePayService } from '../services/payService';
import storage from '../persistence/storage';
import queue from '../persistence/queue';
import lock from '../persistence/lock';

const router = Router();

const ticketService = new TicketService({
  airlineService: new FakeAirlineService(250, 3000, 20),
  payService: new FakePayService(250, 3000, 10),
  storage,
  queue,
  lock,
  lockMs: 3 * 60 * 1000,
});

if (globalMiddles.length) {
  router.use(globalMiddles);
}

router.get('/routes', async (_req: Request, res: Response) => {
  const data = await ticketService.getRouteList();
  res.json(success(data));
});

router.get(
  '/flightList',
  [check('routeId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { routeId } = req.query;
    const data = await ticketService.getFlightList(Number(routeId));
    res.json(success(data));
  }
);

router.get(
  '/flight/:id',
  [check('id').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = await ticketService.getFlightInfo(+id);
    res.json(success(data));
  }
);

router.post(
  '/createTicketOrder',
  [body('travelerId').isNumeric(), body('flightId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { travelerId, flightId } = req.body;
    const ticket = await ticketService.createTicketOrder(travelerId, flightId);
    res.json(success(ticket));
  }
);

router.post(
  '/payTicketOrder',
  [body('travelerId').isNumeric(), body('ticketId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { travelerId, ticketId } = req.body;
    const data = await ticketService.payTicketOrder(travelerId, ticketId);
    res.json(success(data));
  }
);

router.post(
  '/cancelTicketOrder',
  [body('travelerId').isNumeric(), body('ticketId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { travelerId, ticketId } = req.body;
    const data = await ticketService.cancelTicketOrder(travelerId, ticketId);
    res.json(success(data));
  }
);

// handle error
router.use((err: Error, req: Request, res: Response, _next: Handler): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.json(fail(400, err, errors.array()));
  } else {
    res.json(fail(500, err));
  }
});

export default router;
