import express from 'express';
import router from './router';

const app: express.Application = express();

app.use('/', router);
const port = 3000;

export default function server() {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
}
