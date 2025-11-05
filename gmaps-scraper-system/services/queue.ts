import Bull from 'bull'
import { redis } from '@/lib/redis'

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

// Create the scrape queue
export const scrapeQueue = new Bull<ScrapeJobData>('gmaps-scrape', {
  createClient: (type) => {
    switch (type) {
      case 'client':
        return redis
      case 'subscriber':
        return redis.duplicate()
      case 'bclient':
        return redis.duplicate()
      default:
        return redis.duplicate()
    }
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30 seconds
    },
    removeOnComplete: false, // Keep completed jobs for history
    removeOnFail: false, // Keep failed jobs for debugging
  },
  settings: {
    maxStalledCount: 2, // Maximum times a job can be stalled before failing
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
  },
})

// Add job to queue
export async function addScrapeJob(data: ScrapeJobData): Promise<Bull.Job<ScrapeJobData>> {
  return await scrapeQueue.add(data, {
    jobId: data.jobId, // Use our job ID as Bull job ID
    priority: 1,
  })
}

// Pause a specific job
export async function pauseScrapeJob(jobId: string): Promise<void> {
  const job = await scrapeQueue.getJob(jobId)
  if (job) {
    // We'll handle pausing in the worker by checking job status in DB
    console.log(`Job ${jobId} marked for pause`)
  }
}

// Resume a specific job
export async function resumeScrapeJob(data: ScrapeJobData): Promise<Bull.Job<ScrapeJobData>> {
  // Add job back to queue with resume data
  return await scrapeQueue.add(data, {
    jobId: data.jobId,
    priority: 2, // Higher priority for resumed jobs
  })
}

// Get queue stats
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    scrapeQueue.getWaitingCount(),
    scrapeQueue.getActiveCount(),
    scrapeQueue.getCompletedCount(),
    scrapeQueue.getFailedCount(),
    scrapeQueue.getDelayedCount(),
    scrapeQueue.getPausedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  }
}

// Clean old jobs
export async function cleanOldJobs(olderThanMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  await scrapeQueue.clean(olderThanMs, 'completed')
  await scrapeQueue.clean(olderThanMs, 'failed')
}

// Event emitter for real-time updates
export class JobEventEmitter {
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
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in event listener:', error)
        }
      })
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
