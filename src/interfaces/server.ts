import express from 'express';
import router from './router';

const app: express.Application = express();

app.use('/', router);

const port = process.env.SERVICE_PORT;
export default function server() {
  app.listen(port, () => {
    console.log(`http api service listening on port ${port}`);
  });
}
