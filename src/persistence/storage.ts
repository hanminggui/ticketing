import _ from 'underscore';
import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { PrismaClient } from '@prisma/client';
import { Traveler, Ticket, Flight, Route, Airport } from '../types';
import { Storage } from './index';

const CACHE_10M = 600;

interface AsyncGet {
  (): Promise<unknown>;
}

export class RedisMysql implements Storage {
  private redisPool: RedisClientType;

  private prisma: PrismaClient;

  private prefix: string;

  private nil: string;

  constructor(config: RedisClientOptions) {
    console.log(`storage mysql Connecting`);
    this.prisma = new PrismaClient({ log: ['warn', 'error'] });
    this.prisma.$connect();

    console.log(`storage redis Connecting ${JSON.stringify(config)}`);
    this.redisPool = createClient(config);
    this.redisPool.connect();
    this.redisPool.on('connect', () => console.log('storage redis connected'));
    this.redisPool.on('error', (err) => {
      throw err;
    });

    this.prefix = 'Storage:';
    this.nil = 'nil';
  }

  private nameKey(name: string): string {
    return `${this.prefix}${name}`;
  }

  private nameIdKey(name: string, id: number): string {
    return `${this.nameKey(name)}:${id}`;
  }

  private async obtain(key: string, seconds: number, asyncGet: AsyncGet): Promise<unknown | null> {
    const v = await this.redisPool.get(key);
    if (!v) {
      const dbv = await asyncGet();
      const resetV = dbv ? JSON.stringify(dbv) : this.nil;
      await this.redisPool.setEx(key, seconds, resetV);
      return resetV === this.nil ? null : JSON.parse(resetV);
    }
    return v === this.nil ? null : JSON.parse(v);
  }

  async getTravelerById(id: number): Promise<Traveler | null> {
    const key = this.nameIdKey('getTravelerById', id);
    const v = await this.obtain(key, CACHE_10M, async (): Promise<Traveler | null> => {
      if (!id) return null;
      const dbTraveler = await this.prisma.traveler.findFirst({ where: { id } });
      if (!dbTraveler) return null;

      const route = await this.getRouteById(dbTraveler.route_id);
      if (!route) return null;

      return {
        id: dbTraveler.id,
        name: dbTraveler.name,
        route,
      };
    });

    return v ? (v as Traveler) : null;
  }

  async getRouteById(id: number): Promise<Route | null> {
    const key = this.nameIdKey('getRouteById', id);
    const v = await this.obtain(key, CACHE_10M, async (): Promise<Route | null> => {
      if (!id) return null;
      const dbRoute = await this.prisma.route.findFirst({ where: { id } });
      if (!dbRoute) return null;

      const fromAirport = await this.getAirportById(dbRoute.from_airport_id);
      const toAirport = await this.getAirportById(dbRoute.to_airport_id);

      if (!fromAirport || !toAirport) return null;

      return {
        id: dbRoute.id,
        airports: [fromAirport, toAirport],
      };
    });

    return v ? (v as Route) : null;
  }

  async getAirportById(id: number): Promise<Airport | null> {
    const key = this.nameIdKey('getAirportById', id);

    const v = await this.obtain(key, CACHE_10M, async (): Promise<Airport | null> => {
      if (!id) return null;
      return this.prisma.airport.findFirst({ where: { id } });
    });

    return v ? (v as Airport) : null;
  }

  async getFlightById(id: number): Promise<Flight | null> {
    const key = this.nameIdKey('getFlightById', id);
    const v = await this.obtain(key, CACHE_10M, async (): Promise<Flight | null> => {
      if (!id) return null;
      const dbFlight = await this.prisma.flight.findFirst({ where: { id } });
      if (!dbFlight) return null;

      const route = await this.getRouteById(dbFlight.route_id);
      if (!route) return null;

      return {
        id: dbFlight.id,
        capacity: dbFlight.capacity,
        basePrice: Number(dbFlight.base_price),
        route,
      };
    });

    return v ? (v as Flight) : null;
  }

  async getTicketById(id: number): Promise<Ticket | null> {
    const key = this.nameIdKey('getTicketById', id);
    const v = await this.obtain(key, CACHE_10M, async (): Promise<Ticket | null> => {
      if (!id) return null;
      const dbTicket = await this.prisma.ticket.findFirst({ where: { id } });
      if (!dbTicket) return null;

      const flight = await this.getFlightById(dbTicket.flight_id);
      if (!flight) return null;

      const ticket: Ticket = {
        id: dbTicket.id,
        flight,
        price: Number(dbTicket.price),
      };

      if (dbTicket.traveler_id) {
        ticket.traveler = (await this.getTravelerById(dbTicket.traveler_id)) as Traveler;
      }
      return ticket;
    });

    return v ? (v as Ticket) : null;
  }

  async getRouteIds(): Promise<number[]> {
    const key = this.nameKey('getRouteIds');
    const v = await this.obtain(key, CACHE_10M, async (): Promise<number[]> => {
      const rows = await this.prisma.route.findMany({
        select: {
          id: true,
        },
      });

      return _.pluck(rows, 'id');
    });

    return v ? (v as number[]) : [];
  }

  async getFlightIdsByRouteId(id: number): Promise<number[]> {
    const key = this.nameIdKey('getFlightIdsByRouteId', id);
    const v = await this.obtain(key, CACHE_10M, async (): Promise<number[]> => {
      const rows = await this.prisma.flight.findMany({
        where: {
          route_id: id,
        },
        select: {
          id: true,
        },
      });

      return _.pluck(rows, 'id');
    });

    return v ? (v as number[]) : [];
  }

  async getUnbookedTicketIds(flightId: number): Promise<number[]> {
    const rows = await this.prisma.ticket.findMany({
      where: {
        flight_id: flightId,
        traveler_id: null,
      },
      select: {
        id: true,
      },
    });

    return _.pluck(rows, 'id');
  }

  async payTicketOrder(travelerId: number, ticketId: number, price: number): Promise<void> {
    await this.prisma.ticket.update({
      data: { traveler_id: travelerId, price },
      where: { id: ticketId },
    });
  }

  async cancelTicketOrder(ticketId: number): Promise<void> {
    await this.prisma.ticket.update({
      data: {
        price: 0,
        traveler_id: null,
      },
      where: {
        id: ticketId,
      },
    });

    const key = this.nameIdKey('getTicketById', ticketId);
    await this.redisPool.del(key);
  }
}

const storage = new RedisMysql({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  database: 0,
});

export default storage;
