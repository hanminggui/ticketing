import { Ticket, Traveler, Route, Flight, Airport } from '../types';

export interface Queue {
  pop(uniqueId: number | string): Promise<string | null>;
  push(uniqueId: number | string, message: string | number, delaySeconds?: number): Promise<void>;
  pushList(uniqueId: number | string, messages: string[] | number[], delaySeconds?: number): Promise<void>;
  fix(uniqueId: number | string, message: string | number): Promise<void>;
  count(uniqueId: number): Promise<number>;
}

export interface Lock {
  lockTraveler(travelerId: number, ticket: Ticket): Promise<boolean>;
  getTravelerLockedTicket(travelerId: number): Promise<Ticket | null>;
  unlockTraveler(travelerId: number, ticketId: number): Promise<void>;
  lockTicket(travelerId: number, ticketId: number): Promise<boolean>;
  unlockTicket(travelerId: number, ticketId: number): Promise<void>;
}

export interface Storage {
  getTravelerById(id: number): Promise<Traveler | null>;
  getRouteById(id: number): Promise<Route | null>;
  getAirportById(id: number): Promise<Airport | null>;
  getFlightById(id: number): Promise<Flight | null>;
  getTicketById(id: number): Promise<Ticket | null>;
  getRouteIds(): Promise<number[]>;
  getFlightIdsByRouteId(id: number): Promise<number[]>;
  getUnbookedTicketIds(flightId: number): Promise<number[]>;
  payTicketOrder(travelerId: number, ticketId: number, price: number): Promise<void>;
  cancelTicketOrder(ticketId: number): Promise<void>;
}
