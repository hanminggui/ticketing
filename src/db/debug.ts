import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function queryA() {
  const airports = await prisma.airport.findMany();
  return airports;
}
