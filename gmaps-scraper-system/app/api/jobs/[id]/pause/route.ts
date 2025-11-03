import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyJobPaused } from '@/services/discord'

// PATCH /api/jobs/[id]/pause - Pause a running job
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

    if (job.status !== 'RUNNING') {
      return NextResponse.json(
        { success: false, error: 'Job is not running' },
        { status: 400 }
      )
    }

    // Update job status
    const updatedJob = await prisma.job.update({
      where: { id: params.id },
      data: {
        status: 'PAUSED',
        pauseReason: 'Manually paused by user',
      },
    })

    // Log pause
    await prisma.systemLog.create({
      data: {
        jobId: params.id,
        level: 'INFO',
        event: 'JOB_PAUSED',
        message: 'Job paused by user',
      },
    })

    // Send Discord notification
    await notifyJobPaused({
      id: updatedJob.id,
      clientName: updatedJob.clientName,
      reason: 'Manually paused by user',
      scrapedCount: updatedJob.scrapedCount,
    })

    return NextResponse.json({
      success: true,
      data: updatedJob,
    })
  } catch (error: any) {
    console.error('Error pausing job:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
