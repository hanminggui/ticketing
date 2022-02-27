import { v4 as uuidv4 } from 'uuid';

export function sleepms(milli: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milli);
  });
}

export function sleep(seconds: number) {
  return sleepms(seconds * 1000);
}

export function getRequestId(length = 8) {
  return Math.random()
    .toString(36)
    .slice(2, length + 2);
}

export function uuid() {
  return uuidv4();
}
