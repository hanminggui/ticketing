import { random, min } from 'underscore';
import { sleepms } from '../util';

const MIN_DELAY = 250;
const MAX_DELAY = 3000;

/**
 * 模拟 航司系统订票接口
 * 有 250ms-3000ms 的延时以及20%的失败率
 * @returns 请求结果 成功 | 失败
 */
async function bookTicket(): Promise<boolean> {
  await sleepms(random(MIN_DELAY, MAX_DELAY));
  return random(10) > 1;
}

async function timeout(timeoutMs: number): Promise<boolean> {
  await sleepms(timeoutMs);
  return false;
}

/**
 * 加入重试机制的航司系统订票接口
 * 失败后会重试
 * 超时后认为锁票失败
 * @param timeoutMs 超时时间 ms
 */
export async function mustBookTicket(timeoutMs: number): Promise<boolean> {
  if (timeoutMs < 1) {
    return false;
  }
  const beginTime = new Date().getTime();
  const booked = await Promise.race([bookTicket(), timeout(min([timeoutMs, MAX_DELAY]))]);
  return booked || mustBookTicket(timeoutMs - (new Date().getTime() - beginTime));
}
