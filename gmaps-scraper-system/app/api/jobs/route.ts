import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addScrapeJob } from '@/services/queue'
import { getCoordsFromLocation, createGrid } from '@/utils/location';

// GET /api/jobs - List all jobs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where = status ? { status: status as any } : {}

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: {
              scrapedPlaces: true,
              failedScrapes: true,
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: jobs,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/jobs - Create new job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      clientName,
      keywords,
      locations,
      maxResultsPerKeyword = 500,
      minDelay = 2000, // Optimized for speed with 3 concurrent workers
      maxDelay = 4000, // Optimized for speed with 3 concurrent workers
      cooldownAfter = 50,
      cooldownDuration = 60000, // Optimized for better throughput
      fieldsToScrape = ['phone', 'rating', 'city', 'businessInfo', 'coordinates'], // Default fields
      gridSize,
    } = body

    // Validation
    if (!clientName || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request. clientName and keywords are required.' },
        { status: 400 }
      )
    }

    // Estimate duration (rough calculation)
    const avgDelay = (minDelay + maxDelay) / 2 / 1000 // seconds
    const cooldownsNeeded = Math.floor((keywords.length * maxResultsPerKeyword) / cooldownAfter)
    const totalCooldownTime = (cooldownsNeeded * cooldownDuration) / 1000 // seconds
    const scrapingTime = keywords.length * maxResultsPerKeyword * avgDelay
    const estimatedDuration = Math.round(scrapingTime + totalCooldownTime) // seconds

    let subLocations = null;
    if (gridSize && locations && locations.length > 0) {
      const { lat, lng } = await getCoordsFromLocation(locations[0]);
      subLocations = createGrid(lat, lng, gridSize);
    }

    // Create job in database
    const job = await prisma.job.create({
      data: {
        clientName,
        keywords,
        locations: locations || [],
        maxResultsPerKeyword,
        minDelay,
        maxDelay,
        cooldownAfter,
        cooldownDuration,
        fieldsToScrape,
        estimatedDuration,
        status: 'PENDING',
        gridSize,
        subLocations,
      },
    })

    // Log job creation
    await prisma.systemLog.create({
      data: {
        jobId: job.id,
        level: 'INFO',
        event: 'JOB_CREATED',
        message: `Job created for client: ${clientName}`,
        metadata: {
          keywords: keywords.length,
          maxResults: maxResultsPerKeyword,
        },
      },
    })

    // Add job to queue
    await addScrapeJob({
      jobId: job.id,
      clientName,
      keywords,
      locations,
      maxResultsPerKeyword,
      minDelay,
      maxDelay,
      cooldownAfter,
      cooldownDuration,
    })

    return NextResponse.json({
      success: true,
      data: job,
    })
  } catch (error: any) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
