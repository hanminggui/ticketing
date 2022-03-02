// import { expect } from 'chai';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'underscore';
import * as sinon from 'sinon';
import { Route, Flight, Ticket, Airport, Traveler } from '../../types';
import { TicketService, currentTicketPrice } from '../../services/ticketService';
import { FakePayService } from '../../services/payService';
import { FakeAirlineService } from '../../services/airlineService';
import { Storage, Queue, Lock, Rollback } from '../../persistence';
import { ServiceError } from '../../error';

chai.use(chaiAsPromised);
const { expect } = chai;
class TestPersistence implements Storage, Queue, Lock {
  result = null;

  arr = [];

  zero = 0;

  tf = false;

  async extendLockTime(travelerId: number, ticketId: number, ms: number): Promise<Rollback[]> {
    return this.arr.map(() => async () => _.noop());
  }

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
  let ticket: Ticket;
  beforeEach(() => {
    ticket = {
      id: 1,
      flight: newFlight(1, 0, 1),
      price: 1,
    };
  });
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
      lockMs: 3000,
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
    // let ticket: Ticket;
    // beforeEach(() => {
    //   ticket = {
    //     id: 1,
    //     flight: newFlight(1, 0, 1),
    //     price: 1,
    //   };
    // });

    it('success. normal', async () => {
      const getFlightById = sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      const getTravelerById = sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      const pop = sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      const lockTicket = sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      const push = sinon.stub(testPersistence, 'push');
      const getTicketById = sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      const lockTraveler = sinon.stub(testPersistence, 'lockTraveler').callsFake(async () => true);
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');

      expect(await ticketService.createTicketOrder(1, 1))
        .to.be.an('object')
        .include(ticket);
      sinon.assert.calledOnce(getFlightById);
      sinon.assert.calledOnce(getTravelerById);
      sinon.assert.calledOnce(pop);
      sinon.assert.calledOnce(lockTicket);
      sinon.assert.calledOnce(push);
      sinon.assert.calledOnce(getTicketById);
      sinon.assert.calledOnce(lockTraveler);
      sinon.assert.notCalled(unlockTraveler);
      sinon.assert.notCalled(unlockTicket);
    });
    it('success. lockTicket failed retry', async () => {
      let flightId = 1;
      const nextFlightId = (): number => {
        flightId += 1;
        return flightId;
      };
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      const pop = sinon.stub(testPersistence, 'pop').callsFake(async () => `${nextFlightId()}`);
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => flightId > 5);
      const push = sinon.stub(testPersistence, 'push');
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      sinon.stub(testPersistence, 'lockTraveler').callsFake(async () => true);
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');

      expect(await ticketService.createTicketOrder(1, 1))
        .to.be.an('object')
        .include(ticket);
      sinon.assert.callCount(pop, 5);
      sinon.assert.calledOnce(push);
      sinon.assert.notCalled(unlockTraveler);
      sinon.assert.notCalled(unlockTicket);
    });

    it('success. lockTraveler failed. has current flight locked ticket', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTraveler').callsFake(async () => false);
      const getTravelerLockedTicket = sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => ticket);

      const push = sinon.stub(testPersistence, 'push');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');

      expect(await ticketService.createTicketOrder(1, 1))
        .to.be.an('object')
        .include(ticket);
      sinon.assert.callCount(push, 2);
      sinon.assert.calledOnce(getTravelerLockedTicket);
      sinon.assert.calledOnce(unlockTraveler);
      sinon.assert.calledOnce(unlockTicket);
    });
    it('failed. invalid traveler', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => null);
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. invalid flight', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => null);
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. The tickets are sold out', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => null);
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. lockTicket success but ticket invalid', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      const push = sinon.stub(testPersistence, 'push');
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => null);
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      try {
        await ticketService.createTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(unlockTraveler);
        sinon.assert.calledOnce(unlockTicket);
        sinon.assert.callCount(push, 2);
      }
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. lockTicket success but ticket invalid2', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      const push = sinon.stub(testPersistence, 'push');
      ticket.traveler = { id: 1, name: '' };
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      try {
        await ticketService.createTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(unlockTraveler);
        sinon.assert.calledOnce(unlockTicket);
        sinon.assert.callCount(push, 2);
      }
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });

    it('failed. lockTraveler failed. booked another flight', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTraveler').callsFake(async () => false);
      const otherTicket = JSON.parse(JSON.stringify(ticket));
      otherTicket.flight.id += 1;
      const getTravelerLockedTicket = sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => otherTicket);
      const push = sinon.stub(testPersistence, 'push');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');

      try {
        await ticketService.createTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(getTravelerLockedTicket);
        sinon.assert.calledOnce(unlockTraveler);
        sinon.assert.calledOnce(unlockTicket);
        sinon.assert.callCount(push, 2);
      }
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });

    it('failed. airline service bookTicket failed', async () => {
      sinon.stub(testPersistence, 'getFlightById').callsFake(async () => newFlight(0, 0, 0));
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      sinon.stub(testPersistence, 'pop').callsFake(async () => 'fakeId');
      sinon.stub(testPersistence, 'lockTicket').callsFake(async () => true);
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      sinon.stub(testPersistence, 'lockTraveler').callsFake(async () => true);
      const push = sinon.stub(testPersistence, 'push');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const mustBookTicket = sinon.stub(airlineService, 'mustBookTicket').callsFake(async () => false);
      try {
        await ticketService.createTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.callCount(push, 2);
        sinon.assert.calledOnce(unlockTraveler);
        sinon.assert.calledOnce(unlockTicket);
        sinon.assert.calledOnce(mustBookTicket);
      }
      return expect(ticketService.createTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
  });

  describe('#payTicketOrder()', () => {
    it('success', async () => {
      const extendLockTime = sinon.stub(testPersistence, 'extendLockTime').callsFake(async () => []);
      const getTravelerById = sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      const getTravelerLockedTicket = sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => ticket);
      const payTicketOrder = sinon.stub(testPersistence, 'payTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const fix = sinon.stub(testPersistence, 'fix');
      const pay = sinon.stub(payService, 'pay').callsFake(async () => true);

      expect(await ticketService.payTicketOrder(1, 1))
        .to.be.an('boolean')
        .eq(true);
      sinon.assert.calledOnce(extendLockTime);
      sinon.assert.calledOnce(getTravelerById);
      sinon.assert.calledOnce(getTravelerLockedTicket);
      sinon.assert.calledOnce(payTicketOrder);
      sinon.assert.calledOnce(fix);
      sinon.assert.calledOnce(pay);
      sinon.assert.calledOnce(unlockTraveler);
      sinon.assert.calledOnce(unlockTicket);
    });
    it('failed. invalid traveler', async () => {
      const extendLockTime = sinon.stub(testPersistence, 'extendLockTime').callsFake(async () => []);
      const getTravelerById = sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => null);
      sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => ticket);
      const payTicketOrder = sinon.stub(testPersistence, 'payTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const fix = sinon.stub(testPersistence, 'fix');
      const pay = sinon.stub(payService, 'pay').callsFake(async () => true);

      try {
        await ticketService.payTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(extendLockTime);
        sinon.assert.calledOnce(getTravelerById);
        sinon.assert.notCalled(payTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(fix);
        sinon.assert.notCalled(pay);
      }
      return expect(ticketService.payTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. unbooked ticket', async () => {
      const extendLockTime = sinon.stub(testPersistence, 'extendLockTime').callsFake(async () => []);
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      const getTravelerLockedTicket = sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => null);
      const payTicketOrder = sinon.stub(testPersistence, 'payTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const fix = sinon.stub(testPersistence, 'fix');
      const pay = sinon.stub(payService, 'pay').callsFake(async () => true);

      try {
        await ticketService.payTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(extendLockTime);
        sinon.assert.calledOnce(getTravelerLockedTicket);
        sinon.assert.notCalled(payTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(fix);
        sinon.assert.notCalled(pay);
      }
      return expect(ticketService.payTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. booked ticket is not input ticket', async () => {
      const extendLockTime = sinon.stub(testPersistence, 'extendLockTime').callsFake(async () => []);
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      const getTravelerLockedTicket = sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => ticket);
      const payTicketOrder = sinon.stub(testPersistence, 'payTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const fix = sinon.stub(testPersistence, 'fix');
      const pay = sinon.stub(payService, 'pay').callsFake(async () => true);
      try {
        await ticketService.payTicketOrder(1, 2);
      } catch (e) {
        sinon.assert.calledOnce(extendLockTime);
        sinon.assert.calledOnce(getTravelerLockedTicket);
        sinon.assert.notCalled(payTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(fix);
        sinon.assert.notCalled(pay);
      }

      return expect(ticketService.payTicketOrder(1, 2)).to.be.rejectedWith(ServiceError);
    });
    it('failed. pay failed', async () => {
      const extendLockTime = sinon.stub(testPersistence, 'extendLockTime').callsFake(async () => []);
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 0, name: '' }));
      const getTravelerLockedTicket = sinon.stub(testPersistence, 'getTravelerLockedTicket').callsFake(async () => ticket);
      const payTicketOrder = sinon.stub(testPersistence, 'payTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const fix = sinon.stub(testPersistence, 'fix');
      const pay = sinon.stub(payService, 'pay').callsFake(async () => false);
      try {
        await ticketService.payTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(extendLockTime);
        sinon.assert.calledOnce(getTravelerLockedTicket);
        sinon.assert.notCalled(payTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(fix);
        sinon.assert.calledOnce(pay);
      }

      return expect(ticketService.payTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
  });
  describe('#cancelTicketOrder()', () => {
    it('success', async () => {
      const getTravelerById = sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 1, name: '' }));
      ticket.traveler = { id: 1, name: '' };
      const getTicketById = sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      const cancelTicketOrder = sinon.stub(testPersistence, 'cancelTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const push = sinon.stub(testPersistence, 'push');

      expect(await ticketService.cancelTicketOrder(1, 1))
        .to.be.an('boolean')
        .eq(true);
      sinon.assert.calledOnce(getTravelerById);
      sinon.assert.calledOnce(getTicketById);
      sinon.assert.calledOnce(cancelTicketOrder);
      sinon.assert.calledOnce(unlockTraveler);
      sinon.assert.calledOnce(unlockTicket);
      sinon.assert.calledOnce(push);
    });
    it('failed. invalid traveler', async () => {
      const getTravelerById = sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => null);
      sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      const cancelTicketOrder = sinon.stub(testPersistence, 'cancelTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const push = sinon.stub(testPersistence, 'push');

      try {
        await ticketService.cancelTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(getTravelerById);
        sinon.assert.notCalled(cancelTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(push);
      }

      return expect(ticketService.cancelTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. invalid ticket', async () => {
      sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 1, name: '' }));
      const getTicketById = sinon.stub(testPersistence, 'getTicketById').callsFake(async () => null);
      const cancelTicketOrder = sinon.stub(testPersistence, 'cancelTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const push = sinon.stub(testPersistence, 'push');

      try {
        await ticketService.cancelTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(getTicketById);
        sinon.assert.notCalled(cancelTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(push);
      }

      return expect(ticketService.cancelTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
    });
    it('failed. cancle other user ticket', async () => {
      const getTravelerById = sinon.stub(testPersistence, 'getTravelerById').callsFake(async () => ({ id: 1, name: '' }));
      ticket.traveler = { id: 2, name: '' };
      const getTicketById = sinon.stub(testPersistence, 'getTicketById').callsFake(async () => ticket);
      const cancelTicketOrder = sinon.stub(testPersistence, 'cancelTicketOrder');
      const unlockTraveler = sinon.stub(testPersistence, 'unlockTraveler');
      const unlockTicket = sinon.stub(testPersistence, 'unlockTicket');
      const push = sinon.stub(testPersistence, 'push');

      try {
        await ticketService.cancelTicketOrder(1, 1);
      } catch (e) {
        sinon.assert.calledOnce(getTravelerById);
        sinon.assert.calledOnce(getTicketById);
        sinon.assert.notCalled(cancelTicketOrder);
        sinon.assert.notCalled(unlockTraveler);
        sinon.assert.notCalled(unlockTicket);
        sinon.assert.notCalled(push);
      }

      return expect(ticketService.cancelTicketOrder(1, 1)).to.be.rejectedWith(ServiceError);
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
