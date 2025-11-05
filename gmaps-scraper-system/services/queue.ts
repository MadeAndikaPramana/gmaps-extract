import 'dotenv/config'
import Bull from 'bull'
import { getBullRedisConfig } from '@/lib/redis'

export interface ScrapeJobData {
  jobId: string
  clientName: string
  keywords: string[]
  locations?: string[]
  maxResultsPerKeyword: number
  minDelay: number
  maxDelay: number
  cooldownAfter: number
  cooldownDuration: number
  resumeFromIndex?: number
}

// Create Bull queue with compatible Redis config
export const scrapeQueue = new Bull('gmaps-scrape', {
  redis: getBullRedisConfig(),
})

// Main job submission function
export async function addScrapeJob(data: ScrapeJobData): Promise<Bull.Job<ScrapeJobData>> {
  return await scrapeQueue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  })
}

// Alias for consistency
export const createScrapeJob = addScrapeJob

// Resume job function
export async function resumeScrapeJob(data: ScrapeJobData): Promise<Bull.Job<ScrapeJobData>> {
  return await scrapeQueue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  })
}

// Queue statistics
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    scrapeQueue.getWaitingCount(),
    scrapeQueue.getActiveCount(),
    scrapeQueue.getCompletedCount(),
    scrapeQueue.getFailedCount(),
    scrapeQueue.getDelayedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  }
}

// Event emitter for real-time updates
class JobEventEmitter {
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}

export const jobEvents = new JobEventEmitter()
