import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export async function checkRedisConnection() {
  await redis.ping();
}

// ─── Cache helpers ─────────────────────────────────────────────────────────

export async function getCache<T>(key: string): Promise<T | null> {
  const val = await redis.get(key);
  if (!val) return null;
  return JSON.parse(val) as T;
}

export async function setCache(key: string, value: unknown, ttlSeconds: number) {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function deleteCache(key: string) {
  await redis.del(key);
}
