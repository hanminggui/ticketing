import { generateData } from './persistence/generateData';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    await generateData();
  }
  await generateData();
  process.exit(0);
}
main();
