// import { expect } from 'chai';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'underscore';
import * as sinon from 'sinon';
import { Route, Flight, Ticket, Airport, Traveler } from '../../../types';
import { TicketService, currentTicketPrice } from '../../../services/ticketService';
import { FakePayService } from '../../../services/payService';
import { FakeAirlineService } from '../../../services/airlineService';
import { Storage, Queue, Lock } from '../../../persistence';
import { ServiceError, ErrorCode } from '../../../error';

chai.use(chaiAsPromised);
const { expect } = chai;
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
    console.log('call push');
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

const expectCurrentTicketPrice = (basePrice: number, booked: number, capacity: number) =>
  +(basePrice * ((booked / capacity) * 2 + 1)).toFixed(2);

describe('TicketService', () => {
  let testPersistence: TestPersistence;
  let ticketService: TicketService;
  let airlineService: FakeAirlineService;
  let payService: FakePayService;

  before(() => {
    testPersistence = new TestPersistence();
    airlineService = new FakeAirlineService(0, 0, 20);
    payService = new FakePayService(0, 0, 10);

    ticketService = new TicketService({
      airlineService,
      payService,
      storage: testPersistence,
      queue: testPersistence,
      lock: testPersistence,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#getFlightInfo()', () => {
    it('Flight not exist', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => null);
      expect(null).to.eq(await ticketService.getFlightInfo(1));
    });
    it('Flight exist. 0 booked', async () => {
      const input = newFlight(100, 0, 10);
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => input);
      sinon.stub(testPersistence, 'count').callsFake(async () => 10);
      const flight = await ticketService.getFlightInfo(1);
      expect(flight).to.be.an('object');
      expect(flight).to.have.deep.include(input);
      expect(flight).to.have.deep.include({ basePrice: 100, capacity: 10, booked: 0, currentTicketPrice: 100 });
    });
    it('Flight exist. 50% booked', async () => {
      const input = newFlight(100, 0, 10);
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => input);
      sinon.stub(testPersistence, 'count').callsFake(async () => 5);
      const flight = await ticketService.getFlightInfo(1);
      expect(flight).to.be.an('object');
      expect(flight).to.have.deep.include(input);
      expect(flight).to.have.deep.include({ basePrice: 100, capacity: 10, booked: 5, currentTicketPrice: 200 });
    });
    it('Flight exist. 90% booked', async () => {
      const input = newFlight(100, 0, 10);
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => input);
      sinon.stub(testPersistence, 'count').callsFake(async () => 1);
      const flight = await ticketService.getFlightInfo(1);
      expect(flight).to.be.an('object');
      expect(flight).to.have.deep.include(input);
      expect(flight).to.have.deep.include({ basePrice: 100, capacity: 10, booked: 9, currentTicketPrice: 280 });
    });
  });
  describe('#getFlightList()', () => {
    it('route not exist throw ServiceError', async () => {
      sinon.stub(testPersistence, 'getRouteById').callsFake(async () => null);
      return expect(ticketService.getFlightList(1)).to.be.rejectedWith(ServiceError);
    });
    it('route not has flight return []', async () => {
      sinon.stub(testPersistence, 'getRouteById').callsFake(async () => ({ id: 1, airports: [] }));
      sinon.stub(testPersistence, 'getFlightIdsByRouteId').callsFake(async () => []);
      const result = await ticketService.getFlightList(1);
      expect(result).to.be.an('array').length(0);
    });
    it('invalid flights return []', async () => {
      sinon.stub(testPersistence, 'getRouteById').callsFake(async () => ({ id: 1, airports: [] }));
      sinon.stub(testPersistence, 'getFlightIdsByRouteId').callsFake(async () => [1, 2, 3, 4]);
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => null);
      const result = await ticketService.getFlightList(1);
      expect(result).to.be.an('array').length(0);
    });
    it('valid flights return Flight[]', async () => {
      const flightLength = 20;
      sinon.stub(testPersistence, 'getRouteById').callsFake(async () => ({ id: 1, airports: [] }));
      sinon.stub(testPersistence, 'getFlightIdsByRouteId').callsFake(async () => _.range(flightLength));
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(100, 0, 10));
      sinon.stub(testPersistence, 'count').callsFake(async () => 5);

      const result = await ticketService.getFlightList(1);
      expect(result).to.be.an('array').length(flightLength);
      _.range(flightLength).map((index: number) => {
        return expect(result[index])
          .to.be.an('object')
          .to.have.deep.include({ basePrice: 100, capacity: 10, booked: 5, currentTicketPrice: 200 });
      });
    });
    it('has invalid flights return valid Flight[]', async () => {
      const flightLength = 20;
      const expectResultLength = Math.floor(flightLength / 2);
      sinon.stub(testPersistence, 'getRouteById').callsFake(async () => ({ id: 1, airports: [] }));
      sinon.stub(testPersistence, 'getFlightIdsByRouteId').callsFake(async () => _.range(flightLength));
      sinon.stub(testPersistence, 'getFlightById').callsFake(async (id: number) => (id % 2 ? newFlight(100, 0, 10) : null));
      sinon.stub(testPersistence, 'count').callsFake(async () => 5);

      const result = await ticketService.getFlightList(1);
      expect(result).to.be.an('array').length(expectResultLength);
      _.range(expectResultLength).map((index: number) => {
        return expect(result[index])
          .to.be.an('object')
          .to.have.deep.include({ basePrice: 100, capacity: 10, booked: 5, currentTicketPrice: 200 });
      });
    });
  });
  describe('#getRouteList()', () => {
    it('route not exist return []', async () => {
      sinon.stub(testPersistence, 'getRouteIds').callsFake(async () => []);
      const result = await ticketService.getRouteList();
      expect(result).to.be.an('array').length(0);
    });
    it('invalid routes return []', async () => {
      sinon.stub(testPersistence, 'getRouteIds').callsFake(async () => [1, 2, 3, 4]);
      sinon.stub(testPersistence, 'getRouteById').callsFake(async () => null);
      const result = await ticketService.getRouteList();
      expect(result).to.be.an('array').length(0);
    });
    it('valid routes return Route[]', async () => {
      const routeCount = 20;
      sinon.stub(testPersistence, 'getRouteIds').callsFake(async () => _.range(routeCount));
      sinon.stub(testPersistence, 'getRouteById').callsFake(async (id: number) => ({ id, airports: [] }));

      const result = await ticketService.getRouteList();
      expect(result).to.be.an('array').length(routeCount);
      _.range(routeCount).map((index: number) => {
        return expect(result[index]).to.be.an('object').to.have.deep.include({ id: index, airports: [] });
      });
    });
    it('has invalid flights return valid Flights[]', async () => {
      const routeCount = 20;
      const expectResultLength = Math.floor(routeCount / 2);
      sinon.stub(testPersistence, 'getRouteIds').callsFake(async () => _.range(routeCount));
      sinon.stub(testPersistence, 'getRouteById').callsFake(async (id: number) => (id % 2 ? { id, airports: [] } : null));

      const result = await ticketService.getRouteList();
      expect(result).to.be.an('array').length(expectResultLength);
      _.range(expectResultLength).map((index: number) => {
        return expect(result[index])
          .to.be.an('object')
          .to.have.deep.include({ id: index * 2 + 1, airports: [] });
      });
    });
  });
  describe('#createTicketOrder()', () => {
    it('success', async () => {
      const mock = sinon.mock(testPersistence);
      const ticket = {
        id: 1,
        flight: newFlight(1, 0, 1),
        price: 1,
      };
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      sinon.stub(testPersistence, 'push');
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      sinon.stub(testPersistence, 'lockTraveler').callsFake(async () => true);

      expect(await testPersistence.lockTraveler(1, ticket)).to.eq(true);
      const result = await ticketService.createTicketOrder(1, 1);
      expect(result).to.be.an('object').include(ticket);

      // mock.expects('getFlightById').atLeast(1).atMost(1);
      expect(mock.expects('getTravelerById').callCount).to.eq(1);
      expect(mock.expects('pop').callCount).to.eq(1);
      expect(mock.expects('lockTicket').callCount).to.eq(1);
      expect(mock.expects('push').callCount).to.eq(1);
      expect(mock.expects('getTicketById').callCount).to.eq(1);
      expect(mock.expects('lockTraveler').callCount).to.eq(1);
    });
    it('invalid traveler', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => null);
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('invalid flight', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => null);
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('The tickets are sold out', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => null);
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('lockTicket success', async () => {
      const mock = sinon.mock(testPersistence);
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      sinon.stub(testPersistence, 'push');
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ({
        id: 1,
        flight: newFlight(1, 0, 1),
        price: 1,
      }));

      await ticketService.createTicketOrder(1, 1);
      expect(mock.expects('push').callCount).to.eq(1);
    });
    it('lockTicket failed retry', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
    });
  });
});

describe('currentTicketPrice', () => {
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
