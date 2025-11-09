import Redis from 'ioredis'

function getRedisUrl(): string {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is not defined')
  }
  return url
}

// Redis client for general use
export const redis = new Redis(getRedisUrl())

// Bull-compatible Redis connection (without problematic options)
export const bullRedisConfig = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // Required for Bull
  enableReadyCheck: false,     // Required for Bull
}

// Alternative: parse from REDIS_URL
export function getBullRedisConfig() {
  const redisUrl = getRedisUrl()
  
  // Parse redis://localhost:6379 or redis://host:port
  const url = new URL(redisUrl)
  
  return {
    host: url.hostname || 'localhost',
    port: parseInt(url.port) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }
}
