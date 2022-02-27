import { ServiceError, isServiceError } from '../error';

type Response = {
  code: number;
  error_msg?: string;
  data?: unknown;
  time: number;
};

export const success = (data: unknown): Response => {
  return {
    code: 0,
    time: new Date().getTime(),
    data,
  };
};

export const fail = (code: number, err: Error, data?: unknown) => {
  return {
    code: isServiceError(err) ? (err as ServiceError).code : code,
    error_msg: err.message,
    time: new Date().getTime(),
    data,
  };
};
