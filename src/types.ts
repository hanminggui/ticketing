export type Airport = {
  id: number;
  name: string;
};

export type Route = {
  id: number;
  airports: Airport[];
};

export type Traveler = {
  id: number;
  name: string;
  route?: Route;
};

export type Ticket = {
  id: number;
  flight: Flight;
  traveler?: Traveler;
  price: number;
};

export type Flight = {
  id: number;
  capacity: number;
  route: Route;
  basePrice: number;
  currentTicketPrice?: number;
  booked?: number;
};
