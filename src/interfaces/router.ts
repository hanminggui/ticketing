import { Request, Response, Handler } from 'express';
import Router from 'express-promise-router';
import { body, validationResult } from 'express-validator';
import { createTicketOrder, payTicketOrder, cancelTicketOrder } from '../services/ticketService';
import { globalMiddles, validateParams } from './middleware';
import { success, fail } from './response';

const router = Router();

if (globalMiddles.length) {
  router.use(globalMiddles);
}

router.post(
  '/createTicketOrder',
  [body('travelerId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { travelerId, flightId } = req.body;
    const data = await createTicketOrder(travelerId, flightId);
    res.json(success(data));
  }
);

router.post(
  '/payTicketOrder',
  [body('travelerId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { travelerId, ticketId } = req.body;
    const data = await payTicketOrder(travelerId, ticketId);
    res.json(success(data));
  }
);

router.post(
  '/cancelTicketOrder',
  [body('travelerId').isNumeric(), validateParams],

  async (req: Request, res: Response) => {
    const { travelerId, ticketId } = req.body;
    const data = await cancelTicketOrder(travelerId, ticketId);
    res.json(success(data));
  }
);

// router.get(
//   '/flightList',
//   [body('travelerId').isNumeric(), validateParams],

//   async (req: Request, res: Response) => {
//     console.log(1);
//   }
// );

// handle error
router.use((err: Error, req: Request, res: Response, _: Handler): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.json(fail(400, err, errors.array()));
  } else {
    res.json(fail(500, err));
  }
});

export default router;
