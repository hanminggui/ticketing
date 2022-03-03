import { random } from 'underscore';
import { sleepms } from '../util';

export class FakePayService {
  minDelay: number;

  maxDelay: number;

  failRate: number;

  /**
   * 模拟第三方支付服务
   * @param minDelay 最低延时 毫秒
   * @param maxDelay 最高延时 毫秒
   * @param failRate 失败比率 % 例如：10 | 20 | 30
   */
  constructor(minDelay: number, maxDelay: number, failRate: number) {
    this.minDelay = minDelay;
    this.maxDelay = maxDelay;
    this.failRate = failRate;
  }

  /**
   * 模拟 第三方支付接口
   * 有 250ms-3000ms 的延时以及10%的失败率
   * @returns 支付结果
   */
  async pay(): Promise<boolean> {
    await sleepms(random(this.minDelay, this.maxDelay));
    return random(99) >= this.failRate;
  }
}
