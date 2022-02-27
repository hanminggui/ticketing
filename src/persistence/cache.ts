import { createClient, RedisClientType, RedisClientOptions } from 'redis';

import { Traveler, Ticket, Flight } from '../types';

import database from './database';

const NIL = 'nil';
const CACHE_10M = 600;

interface AsyncGet {
  (): Promise<unknown>;
}

class Redis {
  private redisPool: RedisClientType;

  private prefix: string;

  constructor(config: RedisClientOptions) {
    console.log(`cache redis Connecting ${JSON.stringify(config)}`);
    this.redisPool = createClient(config);
    this.redisPool.connect();
    this.redisPool.on('connect', () => console.log('cache redis connected'));
    this.redisPool.on('error', (err) => console.log('cache redis error', err));

    this.prefix = 'database:';
  }

  private databaseIdKey(typeName: string, id: number): string {
    return `${this.prefix}${typeName}:${id}`;
  }

  private async obtain(key: string, seconds: number, asyncGet: AsyncGet): Promise<string | null> {
    const v = await this.redisPool.get(key);
    if (!v) {
      const dbv = await asyncGet();
      const resetV = dbv ? JSON.stringify(dbv) : NIL;
      await this.redisPool.setEx(key, seconds, resetV);
      return resetV;
    }
    if (v === NIL) {
      return null;
    }
    return v;
  }

  async getTravelerById(id: number): Promise<Traveler | null> {
    const key = this.databaseIdKey('getTravelerById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getTravelerById(id));

    if (!v) {
      return null;
    }
    return JSON.parse(v as string);
  }

  async getFlightById(id: number): Promise<Flight | null> {
    const key = this.databaseIdKey('getFlightById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getFlightById(id));

    if (!v) {
      return null;
    }
    return JSON.parse(v as string);
  }

  async getTicketById(id: number): Promise<Ticket | null> {
    const key = this.databaseIdKey('getTicketById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getTicketById(id));

    if (!v) {
      return null;
    }
    return JSON.parse(v as string);
  }
}

const redis = new Redis({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  database: 0,
});
export default redis;
