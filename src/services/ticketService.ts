import { FakePayService } from './payService';
import { FakeAirlineService } from './airlineService';
import { Queue, Lock, Storage } from '../persistence';
import { Route, Flight, Ticket } from '../types';
import { ServiceError, ErrorCode } from '../error';

export const currentTicketPrice = (flight: Flight) => +(flight.basePrice * (((flight.booked || 0) / flight.capacity) * 2 + 1)).toFixed(2);

type TicketServiceConfig = {
  airlineService: FakeAirlineService;
  payService: FakePayService;
  queue: Queue;
  lock: Lock;
  storage: Storage;
  lockMs: number;
};

export class TicketService {
  airlineService: FakeAirlineService;

  payService: FakePayService;

  queue: Queue;

  lock: Lock;

  storage: Storage;

  lockMs: number;

  constructor(config: TicketServiceConfig) {
    this.airlineService = config.airlineService;
    this.payService = config.payService;
    this.queue = config.queue;
    this.lock = config.lock;
    this.storage = config.storage;
    this.lockMs = config.lockMs;
  }

  // 从消息队列取未锁定机票 并加锁
  private async lockTicket(travelerId: number, flightId: number, unlockTimestamp: number): Promise<number> {
    const ticketId = await this.queue.pop(flightId);
    if (!ticketId) {
      throw new ServiceError(ErrorCode.FLIGHT_STOCK, 'The tickets are sold out');
    }
    // 尝试加票锁
    const ticketLocked = await this.lock.lockTicket(travelerId, +ticketId, unlockTimestamp);
    if (ticketLocked) {
      await this.queue.push(flightId, ticketId, 180);
      return +ticketId;
    }
    return this.lockTicket(travelerId, flightId, unlockTimestamp);
  }

  // 释放机票，并重新放入消息队列
  private async freeTicket(travelerId: number, flightId: number, ticketId: number): Promise<void> {
    await this.lock.unlockTraveler(travelerId, ticketId);
    await this.lock.unlockTicket(travelerId, ticketId);
    await this.queue.push(flightId, ticketId);
  }

  async getFlightInfo(flightId: number): Promise<Flight | null> {
    const flight = await this.storage.getFlightById(flightId);
    if (!flight) return flight;

    // load flight.booked
    const unbooked = await this.queue.count(flightId);
    flight.booked = flight.capacity - unbooked;

    // set flight.currentTicketPrice
    flight.currentTicketPrice = currentTicketPrice(flight);
    return flight;
  }

  // 根据routeId 查询航班
  async getFlightList(routeId: number): Promise<Flight[]> {
    const route = await this.storage.getRouteById(routeId);
    if (!route) {
      throw new ServiceError(ErrorCode.RESOURCE_INVALID, 'invalid route');
    }

    const flightIds = await this.storage.getFlightIdsByRouteId(routeId);
    const flights = await Promise.all(flightIds.map((id) => this.getFlightInfo(id)));
    return flights.filter((flight) => !!flight) as Flight[];
  }

  async getRouteList(): Promise<Route[]> {
    const routeIds = await this.storage.getRouteIds();
    const routes = await Promise.all(routeIds.map((id) => this.storage.getRouteById(id)));
    return routes.filter((route) => !!route) as Route[];
  }

  // ### **预定机票(Create)**:
  // 1. 由于需要和航司系统对接，并且其系统比较陈旧，所以预定机票(Ticket)有一个随机 250ms-3000ms 的延时以及一个20%的失败率.
  // 1. 你需要处理上述的失败情况以及提供尽量稳定合理的逻辑实现.
  // 1. 机票(Ticket)只能在同一时间被唯一乘客(Traveler)预定，并且其在同一时间只能预定1张机票。预定的机票如果未操作会在 3 分钟后过期.
  // 1. 每个航班(Flight) 的机票(Ticket) 的总预定数量不能大于该航班(Flight)可以被预定的数量.
  async createTicketOrder(travelerId: number, flightId: number): Promise<Ticket> {
    // validates
    const traveler = await this.storage.getTravelerById(travelerId);
    if (!traveler) {
      throw new ServiceError(ErrorCode.TRAVELER_INVALID, 'invalid traveler');
    }

    const flight = await this.getFlightInfo(flightId);
    if (!flight) {
      throw new ServiceError(ErrorCode.FLIGHT_INVALID, 'invalid flight');
    }

    const unlockTimestamp = new Date().getTime() + this.lockMs;
    const ticketId = await this.lockTicket(travelerId, flightId, unlockTimestamp);

    const rollback = async () => this.freeTicket(travelerId, flightId, ticketId);

    const ticket = await this.storage.getTicketById(ticketId);
    if (!ticket || ticket.traveler?.id) {
      await rollback();
      throw new ServiceError(ErrorCode.TICKET_INVALID, 'invalid ticket');
    }

    // set ticket.price
    ticket.price = flight.currentTicketPrice || flight.basePrice;

    // 尝试加用户锁，检查用户是否已经预定其他票
    const travelerLocked = await this.lock.lockTraveler(travelerId, ticket, unlockTimestamp);
    if (!travelerLocked) {
      await rollback();
      // 用户持有，有效期内的锁 如果是相同航班，返回之前的票 否则不允许继续锁票
      const lockedTicket = await this.lock.getTravelerLockedTicket(travelerId);
      if (lockedTicket && lockedTicket.flight.id === ticket.flight.id) {
        return lockedTicket;
      }
      throw new ServiceError(ErrorCode.TRAVELER_BOOKED, 'your booked another ticket');
    }

    // 极端情况下，如果航司系统不可用。需要解除用户锁和票锁
    const booked = await this.airlineService.mustBookTicket(10000);
    if (!booked) {
      await rollback();
      throw new ServiceError(ErrorCode.AIRLINE_FAILED, 'airline service bookTicket failed');
    }

    return ticket;
  }

  // ### **购买机票(Pay)**:
  // 1. 由于客户购买机票通过第三方支付接口，例如微信，支付宝，甚至信用卡中心，所以购买机票(Ticket) 有一个随机的 250ms-3000ms 的延时以及一个10%的失败率， 客户支付失败之后可以重新尝试支付该订单。
  // 1. 每个航班(Flight) 的机票(Ticket) 的总购买数量不能大于该航班 (Flight) 的capacity.
  // 1. 机票(Ticket)只能在同一时间被唯一持有该机票预定权的乘客(Traveler) 在预定时间过期(Holding Expiration) 内购买.
  async payTicketOrder(travelerId: number, ticketId: number): Promise<boolean> {
    //  尝试支付时延长锁过期时间，防止支付期间锁过期。支付验证失败后，还原锁过期时间

    const lockRollbacks = await this.lock.extendLockTime(travelerId, ticketId, new Date().getTime() + this.lockMs);
    const rollback = async () => {
      if (!lockRollbacks.length) return;
      await Promise.all(lockRollbacks);
    };

    const lockedTicket = await this.lock.getTravelerLockedTicket(travelerId);
    if (!lockedTicket) {
      await rollback();
      throw new ServiceError(ErrorCode.TICKET_UNBOOKED, 'please book your ticket first');
    }

    if (lockedTicket.id !== ticketId) {
      await rollback();
      throw new ServiceError(ErrorCode.TICKET_UNBOOKED, 'You have other unpaid ticket');
    }

    const traveler = await this.storage.getTravelerById(travelerId);
    if (!traveler) {
      await rollback();
      throw new ServiceError(ErrorCode.TRAVELER_INVALID, 'invalid traveler');
    }

    const paySuccess = await this.payService.pay();
    if (!paySuccess) {
      await rollback();
      throw new ServiceError(ErrorCode.PAY_FAILED, 'pay failed');
    }

    // update database ticket
    await this.storage.payTicketOrder(travelerId, ticketId, lockedTicket.price);

    await this.queue.fix(lockedTicket.flight.id, ticketId);

    // unlock
    await this.lock.unlockTraveler(travelerId, ticketId);
    await this.lock.unlockTicket(travelerId, ticketId);

    return true;
  }

  // ### **取消机票(Cancel)**:
  // 1. 你需要合理的检查机票是否可以被取消。
  // 1. 乘客取消了机票之后，可以被其他乘客购买。
  // 1. 机票(Ticket) 只能被购买了该机票的乘客(Traveler) 取消.
  async cancelTicketOrder(travelerId: number, ticketId: number): Promise<boolean> {
    // validate
    const traveler = await this.storage.getTravelerById(travelerId);
    if (!traveler) {
      throw new ServiceError(ErrorCode.TRAVELER_INVALID, 'invalid traveler');
    }

    const ticket = await this.storage.getTicketById(ticketId);
    if (!ticket) {
      throw new ServiceError(ErrorCode.TICKET_INVALID, 'invalid ticket');
    }

    if (ticket.traveler?.id !== traveler.id) {
      throw new ServiceError(ErrorCode.RESOURCE_INVALID, 'invalid argument');
    }

    // update database ticket
    await this.storage.cancelTicketOrder(ticketId);
    await this.freeTicket(travelerId, ticket.flight.id, ticketId);

    return true;
  }
}
