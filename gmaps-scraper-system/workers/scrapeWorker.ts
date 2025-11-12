import 'dotenv/config'
import { scrapeQueue, ScrapeJobData, jobEvents, addEmailScrapeJob } from '@/services/queue'
import { GoogleMapsScraper } from '@/services/scraper'
import { prisma } from '@/lib/prisma'
import {
  notifyJobStarted,
  notifyJobCompleted,
  notifyJobFailed,
  notifyJobPaused,
  notifyCaptchaDetected,
  notifyMilestone,
} from '@/services/discord'
import { Job as BullJob } from 'bull'

// Process jobs with 3 concurrent workers for faster scraping
scrapeQueue.process(3, async (job: BullJob<ScrapeJobData>) => {
  const { jobId, keywords, locations, maxResultsPerKeyword, minDelay, maxDelay } = job.data

  // Generate unique worker ID for debugging
  const workerId = `Worker-${Math.random().toString(36).substr(2, 4)}`

  console.log(`[${workerId}] 🚀 Starting job ${jobId}`)

  let scraper: GoogleMapsScraper | null = null

  try {
    // Get job from database
    const dbJob = await prisma.job.findUnique({ where: { id: jobId } })

    if (!dbJob) {
      throw new Error('Job not found in database')
    }

    // Check if job is paused
    if (dbJob.status === 'PAUSED') {
      console.log(`[${workerId}] ⏸️  Job ${jobId} is paused, skipping...`)
      return
    }

    // Update job status to RUNNING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: dbJob.startedAt || new Date(),
      },
    })

    // Log job started
    await prisma.systemLog.create({
      data: {
        jobId,
        level: 'INFO',
        event: 'JOB_STARTED',
        message: `Job started for client: ${dbJob.clientName}`,
      },
    })

    // Send Discord notification
    await notifyJobStarted({
      id: jobId,
      clientName: dbJob.clientName,
      keywords,
      maxResultsPerKeyword,
      estimatedDuration: dbJob.estimatedDuration || undefined,
    })

    // Initialize scraper
    scraper = new GoogleMapsScraper()
    await scraper.initialize()

    // Get starting index (for resume capability)
    const startIndex = dbJob.currentKeywordIndex || 0
    let totalScraped = dbJob.scrapedCount || 0
    let totalFailed = dbJob.failedCount || 0

    // Process each keyword
    for (let i = startIndex; i < keywords.length; i++) {
      const keyword = keywords[i]

      // Check if job was paused
      const currentJob = await prisma.job.findUnique({ where: { id: jobId } })
      if (currentJob?.status === 'PAUSED') {
        console.log(`[${workerId}] ⏸️  Job ${jobId} was paused, stopping...`)
        await scraper.close()
        return
      }

      // Update current keyword
      await prisma.job.update({
        where: { id: jobId },
        data: {
          currentKeyword: keyword,
          currentKeywordIndex: i,
        },
      })

      console.log(`[${workerId}] 🔍 Processing keyword ${i + 1}/${keywords.length}: ${keyword}`)

      const searchLocations = (dbJob.subLocations as any[])?.length ? dbJob.subLocations : (locations || []);

      // Process with or without locations
      if (searchLocations.length > 0) {
        for (let j = 0; j < searchLocations.length; j++) {
          const location = searchLocations[j];
          try {
            const places = await scraper.searchPlaces(keyword, location)

            if(dbJob.subLocations) {
                await prisma.job.update({
                  where: { id: jobId },
                  data: { currentSubLocationIndex: j + 1 },
                });
            }

            // Limit results per keyword
            const limitedPlaces = places.slice(0, maxResultsPerKeyword)

            // Save to database
            for (let placeIndex = 0; placeIndex < limitedPlaces.length; placeIndex++) {
              const place = limitedPlaces[placeIndex]
              try {
                console.log(`[${workerId}] >>> Saving place ${placeIndex + 1}/${limitedPlaces.length}: ${place.name}`)

                const dbStartTime = Date.now()
                await prisma.scrapedPlace.create({
                  data: {
                    jobId,
                    placeId: place.placeId,
                    name: place.name,
                    address: place.address,
                    city: place.city,
                    rating: place.rating,
                    reviewsCount: place.reviewsCount,
                    phone: place.phone,
                    website: place.website,
                    email: place.email,
                    facebook: place.facebook,
                    instagram: place.instagram,
                    twitter: place.twitter,
                    linkedin: place.linkedin,
                    plusCode: place.plusCode,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    businessStatus: place.businessStatus,
                    businessTypes: place.businessTypes || [],
                    openingHours: place.openingHours || {},
                    about: place.about,
                  },
                })
                const dbDuration = Date.now() - dbStartTime

                totalScraped++
                console.log(`[${workerId}] ✓ Saved in ${dbDuration}ms. Total: ${totalScraped}`)

                // Update progress
                await prisma.job.update({
                  where: { id: jobId },
                  data: { scrapedCount: totalScraped },
                })

                // Emit real-time update
                jobEvents.emit('job:progress', {
                  jobId,
                  scrapedCount: totalScraped,
                  currentKeyword: keyword,
                })

                // Milestone notification every 500 places
                if (totalScraped % 500 === 0) {
                  await notifyMilestone({
                    id: jobId,
                    clientName: dbJob.clientName,
                    scrapedCount: totalScraped,
                    totalEstimated: keywords.length * maxResultsPerKeyword,
                  })
                }

                // If website exists, queue for email scraping
                if (place.website) {
                  await addEmailScrapeJob({
                    placeId: place.placeId,
                    website: place.website,
                  });
                }
              } catch (error: any) {
                // Handle duplicate place_id
                if (error.code === 'P2002') {
                  console.log(`[${workerId}] ⚠️  Duplicate place: ${place.name} (${place.placeId})`)
                  continue
                }
                throw error
              }
            }

            console.log(
              `[${workerId}] ✅ Scraped ${limitedPlaces.length} places for "${keyword}" in "${location}"`
            )
          } catch (error: any) {
            if (error.message === 'CAPTCHA_DETECTED') {
              // Pause job and notify
              await prisma.job.update({
                where: { id: jobId },
                data: {
                  status: 'PAUSED',
                  pauseReason: 'CAPTCHA detected',
                },
              })

              await notifyCaptchaDetected({
                id: jobId,
                clientName: dbJob.clientName,
                scrapedCount: totalScraped,
              })

              await prisma.systemLog.create({
                data: {
                  jobId,
                  level: 'CRITICAL',
                  event: 'CAPTCHA_DETECTED',
                  message: 'CAPTCHA detected, job paused',
                },
              })

              await scraper.close()
              return
            }

            // Log failed scrape
            await prisma.failedScrape.create({
              data: {
                jobId,
                keyword,
                location: typeof location === 'object' ? JSON.stringify(location) : location,
                errorType: error.name || 'UNKNOWN_ERROR',
                errorMessage: error.message || 'Unknown error occurred',
              },
            })

            totalFailed++

            await prisma.job.update({
              where: { id: jobId },
              data: { failedCount: totalFailed },
            })

            console.error(`[${workerId}] ❌ Failed to scrape "${keyword}" in "${location}":`, error)
          }
        }
      } else {
        // No locations specified
        try {
          const places = await scraper.searchPlaces(keyword)

          const limitedPlaces = places.slice(0, maxResultsPerKeyword)

          for (let placeIndex = 0; placeIndex < limitedPlaces.length; placeIndex++) {
            const place = limitedPlaces[placeIndex]
            try {
              console.log(`[${workerId}] >>> Saving place ${placeIndex + 1}/${limitedPlaces.length}: ${place.name}`)

              const dbStartTime = Date.now()
              await prisma.scrapedPlace.create({
                data: {
                  jobId,
                  placeId: place.placeId,
                  name: place.name,
                  address: place.address,
                  city: place.city,
                  rating: place.rating,
                  reviewsCount: place.reviewsCount,
                  phone: place.phone,
                  website: place.website,
                  email: place.email,
                  facebook: place.facebook,
                  instagram: place.instagram,
                  twitter: place.twitter,
                  linkedin: place.linkedin,
                  plusCode: place.plusCode,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  businessStatus: place.businessStatus,
                  businessTypes: place.businessTypes || [],
                  openingHours: place.openingHours || {},
                  about: place.about,
                },
              })
              const dbDuration = Date.now() - dbStartTime

              totalScraped++
              console.log(`[${workerId}] ✓ Saved in ${dbDuration}ms. Total: ${totalScraped}`)

              await prisma.job.update({
                where: { id: jobId },
                data: { scrapedCount: totalScraped },
              })

              jobEvents.emit('job:progress', {
                jobId,
                scrapedCount: totalScraped,
                currentKeyword: keyword,
              })

              if (totalScraped % 500 === 0) {
                await notifyMilestone({
                  id: jobId,
                  clientName: dbJob.clientName,
                  scrapedCount: totalScraped,
                  totalEstimated: keywords.length * maxResultsPerKeyword,
                })
              }

              if (place.website) {
                await addEmailScrapeJob({
                  placeId: place.placeId,
                  website: place.website,
                });
              }
            } catch (error: any) {
              if (error.code === 'P2002') {
                console.log(`[${workerId}] ⚠️  Duplicate place: ${place.name} (${place.placeId})`)
                continue
              }
              throw error
            }
          }

          console.log(`[${workerId}] ✅ Scraped ${limitedPlaces.length} places for "${keyword}"`)
        } catch (error: any) {
          if (error.message === 'CAPTCHA_DETECTED') {
            await prisma.job.update({
              where: { id: jobId },
              data: {
                status: 'PAUSED',
                pauseReason: 'CAPTCHA detected',
              },
            })

            await notifyCaptchaDetected({
              id: jobId,
              clientName: dbJob.clientName,
              scrapedCount: totalScraped,
            })

            await prisma.systemLog.create({
              data: {
                jobId,
                level: 'CRITICAL',
                event: 'CAPTCHA_DETECTED',
                message: 'CAPTCHA detected, job paused',
              },
            })

            await scraper.close()
            return
          }

          await prisma.failedScrape.create({
            data: {
              jobId,
              keyword,
              errorType: error.name || 'UNKNOWN_ERROR',
              errorMessage: error.message || 'Unknown error occurred',
            },
          })

          totalFailed++

          await prisma.job.update({
            where: { id: jobId },
            data: { failedCount: totalFailed },
          })

          console.error(`[${workerId}] ❌ Failed to scrape "${keyword}":`, error)
        }
      }
    }

    // Job completed successfully
    const completedAt = new Date()
    const startedAt = dbJob.startedAt || new Date()
    const duration = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt,
      },
    })

    await prisma.systemLog.create({
      data: {
        jobId,
        level: 'INFO',
        event: 'JOB_COMPLETED',
        message: `Job completed. Scraped ${totalScraped} places, ${totalFailed} failed`,
      },
    })

    await notifyJobCompleted({
      id: jobId,
      clientName: dbJob.clientName,
      scrapedCount: totalScraped,
      failedCount: totalFailed,
      duration,
    })

    jobEvents.emit('job:completed', { jobId })

    console.log(`[${workerId}] 🎉 Job ${jobId} completed successfully`)
  } catch (error: any) {
    console.error(`[${workerId}] ❌ Job ${jobId} failed:`, error)

    // Update job status to FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: error.message || 'Unknown error occurred',
      },
    })

    await prisma.systemLog.create({
      data: {
        jobId,
        level: 'ERROR',
        event: 'JOB_FAILED',
        message: error.message || 'Job failed with unknown error',
      },
    })

    const dbJob = await prisma.job.findUnique({ where: { id: jobId } })

    if (dbJob) {
      await notifyJobFailed({
        id: jobId,
        clientName: dbJob.clientName,
        error: error.message || 'Unknown error',
        scrapedCount: dbJob.scrapedCount,
      })
    }

    jobEvents.emit('job:failed', { jobId, error: error.message })

    throw error
  } finally {
    if (scraper) {
      await scraper.close()
    }
  }
})

// Queue event handlers
scrapeQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`)
})

scrapeQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err)
})

scrapeQueue.on('stalled', (job) => {
  console.warn(`⚠️  Job ${job.id} stalled`)
})

console.log('🤖 Scrape worker started with 3 concurrent workers - listening for jobs...')
