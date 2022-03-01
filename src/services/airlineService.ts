import { random, min, max } from 'underscore';
import { sleepms } from '../util';

async function timeout(timeoutMs: number): Promise<boolean> {
  await sleepms(timeoutMs);
  return false;
}

export class FakeAirlineService {
  minDelay: number;

  maxDelay: number;

  failRate: number;

  /**
   * 模拟航司系统
   * @param minDelay 最低延时 毫秒
   * @param maxDelay 最高延时 毫秒
   * @param failRate 失败比率 % 例如：10 | 20 | 30
   */
  constructor(minDelay: number, maxDelay: number, failRate: number) {
    this.minDelay = minDelay;
    this.maxDelay = maxDelay;
    this.failRate = max([min([failRate, 0]), 100]);
  }

  /**
   * 订票接口
   * 有 250ms-3000ms 的延时以及20%的失败率
   * @returns 请求结果 成功 | 失败
   */
  private async bookTicket(): Promise<boolean> {
    await sleepms(random(this.minDelay, this.maxDelay));
    return random(100) >= this.failRate;
  }

  /**
   * 加入重试机制的航司系统订票接口
   * 失败后会重试
   * 超时后认为锁票失败
   * @param timeoutMs 超时时间 ms
   */
  async mustBookTicket(timeoutMs: number): Promise<boolean> {
    if (timeoutMs < 1) {
      return false;
    }
    const beginTime = new Date().getTime();
    const booked = await Promise.race([this.bookTicket(), timeout(min([timeoutMs, this.maxDelay]))]);
    return booked || this.mustBookTicket(timeoutMs - (new Date().getTime() - beginTime));
  }
}

// const MIN_DELAY = 250;
// const MAX_DELAY = 3000;

// /**
//  * 模拟 航司系统订票接口
//  * 有 250ms-3000ms 的延时以及20%的失败率
//  * @returns 请求结果 成功 | 失败
//  */
// async function bookTicket(): Promise<boolean> {
//   await sleepms(random(MIN_DELAY, MAX_DELAY));
//   return random(10) > 1;
// }

// /**
//  * 加入重试机制的航司系统订票接口
//  * 失败后会重试
//  * 超时后认为锁票失败
//  * @param timeoutMs 超时时间 ms
//  */
// export async function mustBookTicket(timeoutMs: number): Promise<boolean> {
//   if (timeoutMs < 1) {
//     return false;
//   }
//   const beginTime = new Date().getTime();
//   const booked = await Promise.race([bookTicket(), timeout(min([timeoutMs, MAX_DELAY]))]);
//   return booked || mustBookTicket(timeoutMs - (new Date().getTime() - beginTime));
// }
