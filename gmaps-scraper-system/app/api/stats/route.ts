import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQueueStats } from '@/services/queue'

// GET /api/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Get job statistics
    const [
      activeJobs,
      todayJobs,
      totalJobs,
      completedJobs,
      failedJobs,
      todayScrapedCount,
      totalScrapedCount,
    ] = await Promise.all([
      prisma.job.count({
        where: {
          status: {
            in: ['RUNNING', 'PENDING'],
          },
        },
      }),
      prisma.job.count({
        where: {
          createdAt: {
            gte: startOfToday,
          },
        },
      }),
      prisma.job.count(),
      prisma.job.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.job.count({
        where: { status: 'FAILED' },
      }),
      prisma.scrapedPlace.count({
        where: {
          scrapedAt: {
            gte: startOfToday,
          },
        },
      }),
      prisma.scrapedPlace.count(),
    ])

    // Get queue stats
    const queueStats = await getQueueStats()

    // Get active jobs details
    const activeJobsList = await prisma.job.findMany({
      where: {
        status: {
          in: ['RUNNING', 'PENDING'],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    })

    // Calculate system health
    const systemStatus =
      queueStats.active > 0 ? 'active' : queueStats.waiting > 0 ? 'waiting' : 'idle'

    return NextResponse.json({
      success: true,
      data: {
        jobs: {
          active: activeJobs,
          today: todayJobs,
          total: totalJobs,
          completed: completedJobs,
          failed: failedJobs,
        },
        places: {
          today: todayScrapedCount,
          total: totalScrapedCount,
        },
        queue: queueStats,
        system: {
          status: systemStatus,
        },
        activeJobs: activeJobsList,
      },
    })
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
