import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { Queue } from './index';

// 封装消息队列相关逻辑 用redis实现延时队列 单独封装是为了替换实现时不修改service业务逻辑
export class RedisQueue implements Queue {
  private redisPool: RedisClientType;

  private prefix: string;

  constructor(config: RedisClientOptions, name: string) {
    console.log(`queue redis Connecting ${JSON.stringify(config)}`);
    this.redisPool = createClient(config);
    this.redisPool.connect();
    this.redisPool.on('connect', () => console.log('queue redis connected'));
    this.redisPool.on('error', (err) => console.log('queue redis error', err));

    this.prefix = `queue:${name}:`;
  }

  private queueKey(uniqueId: number | string): string {
    return `${this.prefix}${uniqueId}`;
  }

  async pop(uniqueId: number | string): Promise<string | null> {
    const key = this.queueKey(uniqueId);
    const score = new Date().getTime();

    const messages = await this.redisPool.zRangeByScore(key, '-inf', score);
    if (!messages.length) {
      return null;
    }

    const message = messages[0];
    await this.redisPool.zRem(key, message);
    console.log(`pop ${key} value: ${message}`);
    return message;
  }

  async push(uniqueId: number | string, message: string | number, delaySeconds = 0): Promise<void> {
    const key = this.queueKey(uniqueId);

    const score = new Date().getTime() + delaySeconds * 1000;
    await this.redisPool.zAdd(key, { score, value: `${message}` });
    console.log(`push ${key} value: ${message} score: ${score}`);
  }

  async pushList(uniqueId: number | string, messages: string[] | number[], delaySeconds = 0): Promise<void> {
    const key = this.queueKey(uniqueId);

    const score = new Date().getTime() + delaySeconds * 1000;

    await this.redisPool.zAdd(
      key,
      messages.map((message) => ({ score, value: `${message}` }))
    );
  }

  async fix(uniqueId: number | string, message: string | number): Promise<void> {
    const key = this.queueKey(uniqueId);

    await this.redisPool.zRem(key, `${message}`);
  }

  async count(uniqueId: number): Promise<number> {
    const key = this.queueKey(uniqueId);

    return this.redisPool.zCount(key, 0, new Date().getTime());
  }
}

const queue = new RedisQueue(
  {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    database: 2,
  },
  'unbookedTicket'
);

export default queue;
