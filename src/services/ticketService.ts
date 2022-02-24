import { Airport, Route, Traveler, Ticket, Flight } from '../types';

export const createTicketOrder = async (travelerId: number, ticketId: number): Promise<boolean> => {
  return travelerId === ticketId;
};

export const payTicketOrder = async (): Promise<boolean> => {
  return false;
};

export const cancelTicketOrder = async (): Promise<void> => {
  console.log(1);
};
