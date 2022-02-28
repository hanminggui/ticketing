import { random } from 'underscore';
import { sleepms } from '../util';

const MIN_DELAY = 250;
const MAX_DELAY = 3000;
/**
 * 模拟 第三方支付接口
 * 有 250ms-3000ms 的延时以及10%的失败率
 * @returns 支付结果
 */
export async function pay(): Promise<boolean> {
  await sleepms(random(MIN_DELAY, MAX_DELAY));
  return random(10) > 0;
}
