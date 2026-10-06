import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from './config';

/**
 * Small cache abstraction. Uses Redis when REDIS_URL is configured and falls back to an
 * in-process Map otherwise, so local development works without Redis.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis?: Redis;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 1 });
      this.redis.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = this.redis ? await this.redis.get(key) : this.memoryGet(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    try {
      if (this.redis) await this.redis.set(key, raw, 'EX', ttlSeconds);
      else this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
    } catch {
      // Cache failures must never break a request
    }
  }

  async wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      if (this.redis) {
        const stream = this.redis.scanStream({ match: `${prefix}*`, count: 100 });
        for await (const keys of stream as AsyncIterable<string[]>) {
          if (keys.length) await this.redis.del(...keys);
        }
      } else {
        for (const key of this.memory.keys()) if (key.startsWith(prefix)) this.memory.delete(key);
      }
    } catch {
      // ignore
    }
  }

  private memoryGet(key: string): string | undefined {
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}
