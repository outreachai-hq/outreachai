import { ConnectionOptions } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const url = new URL(REDIS_URL)

// BullMQ ConnectionOptions (plain object, not an IORedis instance)
export const redisConnection: ConnectionOptions = {
  host: url.hostname,
  port: parseInt(url.port || '6379', 10),
  password: url.password || undefined,
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
}
