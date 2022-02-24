import { Request, Response, Handler } from 'express';
import Router from 'express-promise-router';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import { createTicketOrder } from '../services/ticketService';
import { globalMiddles } from './middleware';
import { sleep } from '../util';
// TODO https://express-validator.github.io/docs/check-api.html
const router = Router();

router.use((err: Error, req: Request, res: Response, next: Handler) => {
  res.status(403).send(err.message);
});
if (globalMiddles.length) {
  router.use(globalMiddles);
}

router.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

router.get('/timeout', async (req: Request, res: Response) => {
  await sleep(10);
});

router.post('/createTicketOrder', async (req: Request, res: Response) => {
  const { travelerId, ticketId } = req.body;
  const success = await createTicketOrder(travelerId, ticketId);
  res.json({ success });
});

// root 提供所有 API 入口端点相应的解析器函数
const root = {
  hello: () => {
    return 'Hello world!';
  },
};

const schema = buildSchema(`
type Query {
  hello: String
}
`);

router.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  })
);

export default router;
