import { generateData } from './persistence/generateData';

async function main() {
  await generateData();
  process.exit(0);
}
main();
