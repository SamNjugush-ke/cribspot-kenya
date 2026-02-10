import Redis from "ioredis";
export const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

export const cacheGet = async (key: string) => redis ? await redis.get(key) : null;
export const cacheSet = async (key: string, value: any, ttlSec = 60) =>
  redis ? await redis.set(key, JSON.stringify(value), "EX", ttlSec) : null;