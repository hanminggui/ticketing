import * as payService from './payService';
import * as airlineService from './airlineService';
import database from '../persistence/database';
import cache from '../persistence/cache';
import lock from '../persistence/lock';
import { unbookedTicketQueue } from '../persistence/queue';
import { ServiceError, ErrorCode } from '../error';
import { Route, Flight, Ticket } from '../types';

// 从消息队列取未锁定机票 并加锁
async function lockTicket(travelerId: number, flightId: number): Promise<number> {
  const ticketId = await unbookedTicketQueue.pop(flightId);
  if (!ticketId) {
    throw new ServiceError(ErrorCode.FLIGHT_STOCK, 'The tickets are sold out');
  }
  // 尝试加票锁
  const ticketLocked = await lock.lockTicket(travelerId, +ticketId);
  if (ticketLocked) {
    await unbookedTicketQueue.push(flightId, ticketId, 180);
    return +ticketId;
  }
  return lockTicket(travelerId, flightId);
}

// 释放机票，并重新放入消息队列
async function freeTicket(travelerId: number, flightId: number, ticketId: number): Promise<void> {
  await lock.unlockTraveler(travelerId, ticketId);
  await lock.unlockTicket(travelerId, ticketId);
  await unbookedTicketQueue.push(flightId, ticketId);
}

const currentTicketPrice = (flight: Flight) => +(flight.basePrice * (((flight.booked || 0) / flight.capacity) * 2 + 1)).toFixed(2);

export async function getFlightInfo(flightId: number): Promise<Flight | null> {
  console.log(`getFlightInfo(${flightId})`);
  const flight = await cache.getFlightById(flightId);
  if (!flight) return flight;

  // load flight.booked
  const unbooked = await unbookedTicketQueue.count(flightId);
  flight.booked = flight.capacity - unbooked;

  // set flight.currentTicketPrice
  flight.currentTicketPrice = currentTicketPrice(flight);
  return flight;
}

// 根据routeId 查询航班
export async function getFlightList(routeId: number): Promise<Flight[]> {
  const route = await database.getRouteById(routeId);
  if (!route) {
    throw new ServiceError(ErrorCode.RESOURCE_INVALID, 'invalid route');
  }

  const flightIds = await cache.getFlightIdsByRouteId(routeId);
  const flights = await Promise.all(flightIds.map((id) => getFlightInfo(id)));
  return flights.filter((flight) => !!flight) as Flight[];
}

export async function getRouteList(): Promise<Route[]> {
  const routeIds = await cache.getRouteIds();
  const routes = await Promise.all(routeIds.map((id) => cache.getRouteById(id)));
  return routes.filter((route) => !!route) as Route[];
}

// ### **预定机票(Create)**:
// 1. 由于需要和航司系统对接，并且其系统比较陈旧，所以预定机票(Ticket)有一个随机 250ms-3000ms 的延时以及一个20%的失败率.
// 1. 你需要处理上述的失败情况以及提供尽量稳定合理的逻辑实现.
// 1. 机票(Ticket)只能在同一时间被唯一乘客(Traveler)预定，并且其在同一时间只能预定1张机票。预定的机票如果未操作会在 3 分钟后过期.
// 1. 每个航班(Flight) 的机票(Ticket) 的总预定数量不能大于该航班(Flight)可以被预定的数量.
export async function createTicketOrder(travelerId: number, flightId: number): Promise<Ticket> {
  // validates
  const traveler = await cache.getTravelerById(travelerId);
  if (!traveler) {
    throw new ServiceError(ErrorCode.TRAVELER_INVALID, 'invalid traveler');
  }

  const flight = await getFlightInfo(flightId);
  if (!flight) {
    throw new ServiceError(ErrorCode.FLIGHT_INVALID, 'invalid flight');
  }

  const ticketId = await lockTicket(travelerId, flightId);

  const rollback = async () => freeTicket(travelerId, flightId, ticketId);

  const ticket = await cache.getTicketById(ticketId);
  if (!ticket || ticket.traveler?.id) {
    await rollback();
    throw new ServiceError(ErrorCode.TICKET_INVALID, 'invalid ticket');
  }

  // set ticket.price
  ticket.price = flight.currentTicketPrice || flight.basePrice;

  // 尝试加用户锁，检查用户是否已经预定其他票
  const travelerLocked = await lock.lockTraveler(travelerId, ticket);
  if (!travelerLocked) {
    await rollback();
    // 用户持有，有效期内的锁 如果是相同航班，返回之前的票 否则不允许继续锁票
    const lockedTicket = await lock.getTravelerLockedTicket(travelerId);
    if (lockedTicket && lockedTicket.flight.id === ticket.flight.id) {
      return lockedTicket;
    }
    throw new ServiceError(ErrorCode.TRAVELER_BOOKED, 'your booked another ticket');
  }

  // 极端情况下，如果航司系统不可用。需要解除用户锁和票锁
  const booked = await airlineService.mustBookTicket(10000);
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
export async function payTicketOrder(travelerId: number, ticketId: number): Promise<boolean> {
  // TODO validate
  const traveler = await cache.getTravelerById(travelerId);
  if (!traveler) {
    throw new ServiceError(ErrorCode.TRAVELER_INVALID, 'invalid traveler');
  }

  const lockedTicket = await lock.getTravelerLockedTicket(travelerId);
  if (!lockedTicket) {
    throw new ServiceError(ErrorCode.TICKET_UNBOOKED, 'please book your ticket first');
  }

  if (lockedTicket.id !== ticketId) {
    throw new ServiceError(ErrorCode.TICKET_UNBOOKED, 'You have other unpaid ticket');
  }

  const paySuccess = await payService.pay();
  if (!paySuccess) {
    throw new ServiceError(ErrorCode.PAY_FAILED, 'pay failed');
  }

  // update database ticket
  await database.payTicketOrder(travelerId, ticketId, lockedTicket.price);

  await unbookedTicketQueue.fix(lockedTicket.flight.id, ticketId);

  // unlock
  await lock.unlockTraveler(travelerId, ticketId);
  await lock.unlockTicket(travelerId, ticketId);

  return true;
}

// ### **取消机票(Cancel)**:
// 1. 你需要合理的检查机票是否可以被取消。
// 1. 乘客取消了机票之后，可以被其他乘客购买。
// 1. 机票(Ticket) 只能被购买了该机票的乘客(Traveler) 取消.
export async function cancelTicketOrder(travelerId: number, ticketId: number): Promise<boolean> {
  // validate
  const traveler = await cache.getTravelerById(travelerId);
  if (!traveler) {
    throw new ServiceError(ErrorCode.TRAVELER_INVALID, 'invalid traveler');
  }

  const ticket = await cache.getTicketById(ticketId);
  if (!ticket) {
    throw new ServiceError(ErrorCode.TICKET_INVALID, 'invalid ticket');
  }

  if (ticket.traveler?.id !== traveler.id) {
    throw new ServiceError(ErrorCode.RESOURCE_INVALID, 'invalid argument');
  }

  // update database ticket
  await database.cancelTicketOrder(ticketId);
  await cache.refreshTicketById(ticketId);

  await freeTicket(travelerId, ticket.flight.id, ticketId);

  return true;
}
