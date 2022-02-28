import { PrismaClient } from '@prisma/client';
import _ from 'underscore';
import { Airport, Route, Traveler, Ticket, Flight } from '../types';

class Database {
  private prisma: PrismaClient;

  constructor() {
    // this.prisma = new PrismaClient({ log: ['warn', 'error'] });
    this.prisma = new PrismaClient({ log: ['info', 'query', 'warn', 'error'] });
    this.prisma.$connect();
  }

  async getTravelerById(id: number): Promise<Traveler | null> {
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
  }

  async getRouteById(id: number): Promise<Route | null> {
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
  }

  async getAirportById(id: number): Promise<Airport | null> {
    if (!id) return null;
    return this.prisma.airport.findFirst({ where: { id } });
  }

  async getFlightById(id: number): Promise<Flight | null> {
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
  }

  async getTicketById(id: number): Promise<Ticket | null> {
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

  async getFlightIdsByRouteId(routeId: number): Promise<number[]> {
    const rows = await this.prisma.flight.findMany({
      where: {
        route_id: routeId,
      },
      select: {
        id: true,
      },
    });

    return _.pluck(rows, 'id');
  }

  async getRouteIds(): Promise<number[]> {
    const rows = await this.prisma.route.findMany({
      select: {
        id: true,
      },
    });

    return _.pluck(rows, 'id');
  }
}

const database = new Database();
export default database;
