import { NextRequest } from 'next/server'
import { jobEvents } from '@/services/queue'
import { prisma } from '@/lib/prisma'

// Server-Sent Events endpoint for real-time updates
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const jobId = searchParams.get('jobId')

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

      // Send keepalive every 30 seconds
      const keepaliveInterval = setInterval(() => {
        controller.enqueue(encoder.encode('data: {"type":"keepalive"}\n\n'))
      }, 30000)

      // Listen for job progress updates
      const handleProgress = (data: any) => {
        if (!jobId || data.jobId === jobId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'progress',
                ...data,
              })}\n\n`
            )
          )
        }
      }

      const handleCompleted = (data: any) => {
        if (!jobId || data.jobId === jobId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'completed',
                ...data,
              })}\n\n`
            )
          )
        }
      }

      const handleFailed = (data: any) => {
        if (!jobId || data.jobId === jobId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'failed',
                ...data,
              })}\n\n`
            )
          )
        }
      }

      jobEvents.on('job:progress', handleProgress)
      jobEvents.on('job:completed', handleCompleted)
      jobEvents.on('job:failed', handleFailed)

      // Poll for job updates every 5 seconds
      const pollInterval = setInterval(async () => {
        try {
          if (jobId) {
            const job = await prisma.job.findUnique({
              where: { id: jobId },
              select: {
                id: true,
                status: true,
                scrapedCount: true,
                failedCount: true,
                currentKeyword: true,
                currentKeywordIndex: true,
                keywords: true,
              },
            })

            if (job) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'status',
                    jobId: job.id,
                    status: job.status,
                    scrapedCount: job.scrapedCount,
                    failedCount: job.failedCount,
                    currentKeyword: job.currentKeyword,
                    progress:
                      job.currentKeywordIndex && Array.isArray(job.keywords)
                        ? (job.currentKeywordIndex / job.keywords.length) * 100
                        : 0,
                  })}\n\n`
                )
              )
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error)
        }
      }, 5000)

      // Cleanup when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval)
        clearInterval(pollInterval)
        jobEvents.off('job:progress', handleProgress)
        jobEvents.off('job:completed', handleCompleted)
        jobEvents.off('job:failed', handleFailed)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
