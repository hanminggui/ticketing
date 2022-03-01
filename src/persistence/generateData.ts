import _ from 'underscore';
import { PrismaClient, airport, route, flight } from '@prisma/client';
import { uuid } from '../util';
import queue from './queue';
import storage from './storage';

// 初始化数据脚本

const prisma = new PrismaClient({ log: ['error'] });
const TRAVELER_COUNT = 10000;
const FLIGHT_COUNT = 200;
const AIRPORT_COUNT = Math.ceil(Math.sqrt(FLIGHT_COUNT));

async function generateTicket(flights: flight[]) {
  if (!flights.length) return;

  console.log('generateTicket begin');

  const data = flights.map((flightItem) => {
    return _.range(flightItem.capacity).map(() => {
      return {
        uuid: uuid(),
        flight_id: flightItem.id,
        price: 0,
      };
    });
  });

  await prisma.ticket.deleteMany();
  await prisma.ticket.createMany({
    data: _.flatten(data),
    skipDuplicates: true,
  });
  console.log('generateTicket end');
}

async function generateFlight(routes: route[]) {
  console.log('generateFlight begin');

  if (routes.length) {
    const data = _.range(FLIGHT_COUNT).map((index: number) => {
      const thisRoute = routes[index % routes.length];
      return {
        capacity: _.random(20, 80),
        route_id: thisRoute.id,
        base_price: Math.abs(thisRoute.from_airport_id - thisRoute.to_airport_id) * 100,
      };
    });
    await prisma.flight.deleteMany();
    await prisma.flight.createMany({
      data,
      skipDuplicates: true,
    });
  }
  console.log('generateFlight end');

  const flights = await prisma.flight.findMany();
  await generateTicket(flights);
}

async function generateTraveler(routes: route[]) {
  if (!routes.length) return;

  console.log('generateTraveler begin');

  const data = _.range(TRAVELER_COUNT).map((index: number) => ({
    name: `traveler-${index}`,
    route_id: routes[index % routes.length].id,
  }));

  await prisma.traveler.deleteMany();
  await prisma.traveler.createMany({
    data,
    skipDuplicates: true,
  });
  console.log('generateTraveler end');
}

async function generateRoutes(airports: airport[]) {
  console.log('generateRoutes begin');

  if (airports.length) {
    const data = _.flatten(airports.map((from) => airports.map((to) => ({ from_airport_id: from.id, to_airport_id: to.id })))).filter(
      (item) => item.from_airport_id !== item.to_airport_id
    );
    await prisma.route.createMany({
      data,
      skipDuplicates: true,
    });
  }
  console.log('generateRoutes end');

  const routes = await prisma.route.findMany();
  await Promise.all([generateFlight(routes), generateTraveler(routes)]);
}

async function generateAirPorts() {
  console.log('generateAirPorts begin');
  const nowCount = await prisma.airport.count();
  const diffCount = AIRPORT_COUNT - nowCount;

  if (diffCount > 0) {
    const data = _.range(diffCount).map((num: number) => ({
      name: `AirPort-${num}`,
    }));
    await prisma.airport.createMany({
      data,
      skipDuplicates: true,
    });
  }

  const airports = await prisma.airport.findMany();
  console.log('generateAirPorts end');
  await generateRoutes(airports);
}

// 初始化未预定机票延时队列
export async function initUnbookedTickets(flightId: number): Promise<void> {
  const ids = await storage.getUnbookedTicketIds(flightId);
  await queue.pushList(flightId, ids);
}

export async function generateData() {
  console.log(`--- generateData begin`);
  await generateAirPorts();
  console.log(`--- generateData end`);

  console.log(`initUnbookedTickets begin`);
  const flights = await prisma.flight.findMany();

  for (let i = 0; i < flights.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await initUnbookedTickets(flights[i].id);
  }

  console.log(`initUnbookedTickets end`);
}
