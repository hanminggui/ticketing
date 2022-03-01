import { expect } from 'chai';
import _ from 'underscore';
import * as sinon from 'sinon';
import { Route, Flight, Ticket, Airport, Traveler } from '../../../types';
import { TicketService, currentTicketPrice } from '../../../services/ticketService';
import { FakePayService } from '../../../services/payService';
import { FakeAirlineService } from '../../../services/airlineService';
import { Storage, Queue, Lock } from '../../../persistence';

class TestPersistence implements Storage, Queue, Lock {
  result = null;

  arr = [];

  zero = 0;

  tf = false;

  async lockTraveler(travelerId: number, ticket: Ticket): Promise<boolean> {
    return this.tf;
  }

  async getTravelerLockedTicket(travelerId: number): Promise<Ticket | null> {
    return this.result;
  }

  async unlockTraveler(travelerId: number, ticketId: number): Promise<void> {
    this.result = null;
  }

  async lockTicket(travelerId: number, ticketId: number): Promise<boolean> {
    return this.tf;
  }

  async unlockTicket(travelerId: number, ticketId: number): Promise<void> {
    this.result = null;
  }

  async pop(uniqueId: string | number): Promise<string | null> {
    return this.result;
  }

  async push(uniqueId: string | number, message: string | number, delaySeconds?: number): Promise<void> {
    this.result = null;
  }

  async pushList(uniqueId: string | number, messages: string[] | number[], delaySeconds?: number): Promise<void> {
    this.result = null;
  }

  async fix(uniqueId: string | number, message: string | number): Promise<void> {
    this.result = null;
  }

  async count(uniqueId: number): Promise<number> {
    return this.zero;
  }

  async getTravelerById(id: number): Promise<Traveler | null> {
    return this.result;
  }

  async getRouteById(id: number): Promise<Route | null> {
    return this.result;
  }

  async getAirportById(id: number): Promise<Airport | null> {
    return this.result;
  }

  async getFlightById(id: number): Promise<Flight | null> {
    return this.result;
  }

  async getTicketById(id: number): Promise<Ticket | null> {
    return this.result;
  }

  async getRouteIds(): Promise<number[]> {
    return this.arr;
  }

  async getFlightIdsByRouteId(id: number): Promise<number[]> {
    return this.arr;
  }

  async getUnbookedTicketIds(flightId: number): Promise<number[]> {
    return this.arr;
  }

  async payTicketOrder(travelerId: number, ticketId: number, price: number): Promise<void> {
    this.result = null;
  }

  async cancelTicketOrder(ticketId: number): Promise<void> {
    this.result = null;
  }
}

describe('TicketService', () => {
  describe('constructor', () => {
    const testPersistence = new TestPersistence();
    const ticketService = new TicketService({
      airlineService: new FakeAirlineService(0, 0, 20),
      payService: new FakePayService(0, 0, 10),
      storage: testPersistence,
      queue: testPersistence,
      lock: testPersistence,
    });
    sinon.stub(testPersistence, 'pop').callsFake(async () => null);
  });
});

describe('currentTicketPrice', () => {
  const expectCurrentTicketPrice = (basePrice: number, booked: number, capacity: number) =>
    +(basePrice * ((booked / capacity) * 2 + 1)).toFixed(2);
  const newFlight = (basePrice: number, booked: number, capacity: number): Flight => ({
    basePrice,
    capacity,
    booked,
    id: 1,
    route: {
      id: 1,
      airports: [],
    },
  });
  it('random * 100', () => {
    _.range(100).map(() => {
      const basePrice = _.random(999);
      const booked = _.random(999);
      const capacity = _.random(999);
      return expect(currentTicketPrice(newFlight(basePrice, booked, capacity))).to.eq(
        expectCurrentTicketPrice(basePrice, booked, capacity)
      );
    });
  });
});
