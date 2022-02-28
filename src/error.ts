export const isServiceError = (err: Error): boolean => err.name === 'ServiceError';

// eslint-disable-next-line no-shadow
export enum ErrorCode {
  RESOURCE_INVALID = 1001,

  TICKET_INVALID = 1101,
  TICKET_BOOKED = 1102,
  TICKET_UNBOOKED = 1103,

  FLIGHT_INVALID = 1201,
  FLIGHT_STOCK = 1211,

  TRAVELER_INVALID = 1301,
  TRAVELER_BOOKED = 1302,

  PAY_FAILED = 2001,
  AIRLINE_FAILED = 3001,
}

export class ServiceError extends Error {
  code: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
