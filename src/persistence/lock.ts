import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { Ticket } from '../types';
import { Lock } from './index';

// 封装分布式锁相关逻辑 用redis实现 单独封装是为了替换实现时不修改service业务逻辑

export class RedisLock implements Lock {
  private redisPool: RedisClientType;

  private prefix: string;

  constructor(config: RedisClientOptions) {
    console.log(`lock redis Connecting ${JSON.stringify(config)}`);
    this.redisPool = createClient(config);
    this.redisPool.connect();
    this.redisPool.on('connect', () => console.log('lock redis connected'));
    this.redisPool.on('error', (err) => console.log('lock redis error', err));

    this.prefix = 'lock:';
  }

  private lockTravelerKey(id: number): string {
    return `${this.prefix}travelerId:${id}`;
  }

  private lockTicketKey(id: number): string {
    return `${this.prefix}ticketId:${id}`;
  }

  private async lock(key: string, v: string, seconds: number): Promise<boolean> {
    const locked = await this.redisPool.setNX(key, v);
    if (!locked) {
      return locked;
    }
    await this.redisPool.expire(key, seconds);
    return locked;
  }

  /**
   * 用户加锁
   * @param travelerId
   * @param ticket
   * @returns
   */
  async lockTraveler(travelerId: number, ticket: Ticket): Promise<boolean> {
    const travelerKey = this.lockTravelerKey(travelerId);
    return this.lock(travelerKey, JSON.stringify(ticket), 180);
  }

  async getTravelerLockedTicket(travelerId: number): Promise<Ticket | null> {
    const key = this.lockTravelerKey(travelerId);
    const v = await this.redisPool.get(key);
    if (!v) {
      return null;
    }
    const ticket: Ticket = JSON.parse(v);
    return ticket;
  }

  /**
   * 用户解锁
   * @param travelerId
   * @param ticketId
   */
  async unlockTraveler(travelerId: number, ticketId: number): Promise<void> {
    const key = this.lockTravelerKey(travelerId);
    const v = await this.redisPool.get(key);
    if (!v) return;

    const ticket: Ticket = JSON.parse(v);
    if (ticket.id === ticketId) {
      await this.redisPool.del(key);
    }
  }

  /**
   * 票加锁
   * @param travelerId
   * @param ticketId
   * @returns
   */
  async lockTicket(travelerId: number, ticketId: number): Promise<boolean> {
    const ticketKey = this.lockTicketKey(ticketId);
    return this.lock(ticketKey, JSON.stringify(travelerId), 180);
  }

  /**
   * 票解锁
   * @param travelerId
   * @param ticketId
   */
  async unlockTicket(travelerId: number, ticketId: number): Promise<void> {
    const key = this.lockTicketKey(ticketId);
    const v = await this.redisPool.get(key);
    if (v && +v === travelerId) {
      await this.redisPool.del(key);
    }
  }
}

const lock = new RedisLock({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  database: 1,
});
export default lock;
