import { Queue } from 'bullmq'
import { redisConnection } from './redis'

export interface MarketingSendJob {
  campaignId: string
  sendId: string
  leadEmail: string
  leadFirstName: string
  leadLastName?: string | null
  leadCompany?: string | null
  subject: string
  htmlBody: string
  fromName: string
  fromEmail: string
  trackingId: string
  listUnsubscribeUrl: string
  abVariant?: 'A' | 'B'
  // Only the account ID — credentials are fetched+decrypted inside the worker
  // so they never live in Redis in plaintext
  accountId: string
}

export const marketingSendQueue = new Queue<MarketingSendJob>('marketing-send', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
})
