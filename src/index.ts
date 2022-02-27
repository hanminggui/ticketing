import runInterfaceServer from './interfaces/server';
import { generateData } from './persistence/generateData';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    await generateData();
  }
  runInterfaceServer();
}

main();
