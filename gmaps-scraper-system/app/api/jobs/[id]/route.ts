import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/jobs/[id] - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: {
        scrapedPlaces: {
          take: 10,
          orderBy: { scrapedAt: 'desc' },
        },
        failedScrapes: {
          take: 10,
          orderBy: { failedAt: 'desc' },
        },
        systemLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            scrapedPlaces: true,
            failedScrapes: true,
            systemLogs: true,
          },
        },
      },
    })

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: job,
    })
  } catch (error: any) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
