import { random } from 'underscore';
import { sleepms } from '../util';

/**
 * 模拟 航司系统订票接口
 * 有 250ms-3000ms 的延时以及20%的失败率
 * @returns 请求结果 成功 | 失败
 */
async function bookTicket(): Promise<boolean> {
  await sleepms(random(250, 3000));
  return random(10) > 1;
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
  const booked = await bookTicket();

  return booked || mustBookTicket(timeoutMs - (new Date().getTime() - beginTime));
}
