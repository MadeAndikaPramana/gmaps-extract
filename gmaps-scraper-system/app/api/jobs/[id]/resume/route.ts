import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resumeScrapeJob } from '@/services/queue'

// PATCH /api/jobs/[id]/resume - Resume a paused job
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
    })

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    if (job.status !== 'PAUSED') {
      return NextResponse.json(
        { success: false, error: 'Job is not paused' },
        { status: 400 }
      )
    }

    // Update job status to PENDING
    const updatedJob = await prisma.job.update({
      where: { id: params.id },
      data: {
        status: 'PENDING',
        pauseReason: null,
      },
    })

    // Log resume
    await prisma.systemLog.create({
      data: {
        jobId: params.id,
        level: 'INFO',
        event: 'JOB_RESUMED',
        message: 'Job resumed by user',
      },
    })

    // Add job back to queue with resume data
    await resumeScrapeJob({
      jobId: job.id,
      clientName: job.clientName,
      keywords: job.keywords as string[],
      locations: job.locations as string[] | undefined,
      maxResultsPerKeyword: job.maxResultsPerKeyword,
      minDelay: job.minDelay,
      maxDelay: job.maxDelay,
      cooldownAfter: job.cooldownAfter,
      cooldownDuration: job.cooldownDuration,
      resumeFromIndex: job.currentKeywordIndex,
    })

    return NextResponse.json({
      success: true,
      data: updatedJob,
    })
  } catch (error: any) {
    console.error('Error resuming job:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
