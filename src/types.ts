export type Airport = {
  id: string;
  name: string;
};

export type Route = {
  id: string;
  airports: Airport[];
};

export type Traveler = {
  id: string;
  name: string;
};

export type Ticket = {
  id: string;
  flight: Flight;
  traveler?: Traveler;
  price: number;
};

export type Flight = {
  id: string;
  capacity: number;
  route: Route;
  basePrice: number;
};
