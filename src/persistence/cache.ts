import { createClient, RedisClientType, RedisClientOptions } from 'redis';

import { Traveler, Ticket, Flight, Route } from '../types';

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

  private databaseKey(name: string): string {
    return `${this.prefix}${name}`;
  }

  private databaseIdKey(name: string, id: number): string {
    return `${this.databaseKey(name)}:${id}`;
  }

  private async obtain(key: string, seconds: number, asyncGet: AsyncGet): Promise<unknown | null> {
    const v = await this.redisPool.get(key);
    if (!v) {
      const dbv = await asyncGet();
      const resetV = dbv ? JSON.stringify(dbv) : NIL;
      await this.redisPool.setEx(key, seconds, resetV);
      return resetV === NIL ? null : JSON.parse(resetV);
    }
    return v === NIL ? null : JSON.parse(v);
  }

  async getTravelerById(id: number): Promise<Traveler | null> {
    const key = this.databaseIdKey('getTravelerById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getTravelerById(id));

    return v ? (v as Traveler) : null;
  }

  async getRouteById(id: number): Promise<Route | null> {
    const key = this.databaseIdKey('getRouteById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getRouteById(id));

    return v ? (v as Route) : null;
  }

  async getRouteIds(): Promise<number[]> {
    const key = this.databaseKey('getRouteIds');
    const v = await this.obtain(key, CACHE_10M, async () => database.getRouteIds());

    return v ? (v as number[]) : [];
  }

  async getFlightById(id: number): Promise<Flight | null> {
    const key = this.databaseIdKey('getFlightById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getFlightById(id));

    return v ? (v as Flight) : null;
  }

  async getTicketById(id: number): Promise<Ticket | null> {
    const key = this.databaseIdKey('getTicketById', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getTicketById(id));

    return v ? (v as Ticket) : null;
  }

  async getFlightIdsByRouteId(id: number): Promise<number[]> {
    const key = this.databaseIdKey('getFlightIdsByRouteId', id);
    const v = await this.obtain(key, CACHE_10M, async () => database.getFlightIdsByRouteId(id));

    return v ? (v as number[]) : [];
  }

  async refreshTicketById(id: number): Promise<void> {
    const key = this.databaseIdKey('getTicketById', id);
    await this.redisPool.del(key);
    await this.getTicketById(id);
  }
}

const redis = new Redis({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  database: 0,
});
export default redis;
