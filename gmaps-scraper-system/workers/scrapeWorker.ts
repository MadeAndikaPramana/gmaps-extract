import 'dotenv/config'
import { scrapeQueue, ScrapeJobData, jobEvents } from '@/services/queue'
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

// Process jobs with single concurrency (no parallel processing)
scrapeQueue.process(1, async (job: BullJob<ScrapeJobData>) => {
  const { jobId, keywords, locations, maxResultsPerKeyword, minDelay, maxDelay } = job.data

  console.log(`\n========================================`)
  console.log(`Starting job ${jobId}`)
  console.log(`Keywords: ${keywords.join(', ')}`)
  console.log(`Locations: ${locations?.join(', ') || 'None'}`)
  console.log(`========================================\n`)

  let scraper: GoogleMapsScraper | null = null

  try {
    // Get job from database
    const dbJob = await prisma.job.findUnique({ where: { id: jobId } })

    if (!dbJob) {
      throw new Error('Job not found in database')
    }

    // Check if job is paused
    if (dbJob.status === 'PAUSED') {
      console.log(`Job ${jobId} is paused, skipping...`)
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
    try {
      await notifyJobStarted({
        id: jobId,
        clientName: dbJob.clientName,
        keywords,
        maxResultsPerKeyword,
        estimatedDuration: dbJob.estimatedDuration || undefined,
      })
    } catch (error: any) {
      console.log('Failed to send Discord webhook:', error.message)
    }

    // Initialize scraper
    console.log('Initializing scraper...')
    scraper = new GoogleMapsScraper()
    await scraper.initialize()

    // Get starting index (for resume capability)
    const startIndex = dbJob.currentKeywordIndex || 0
    let totalScraped = dbJob.scrapedCount || 0
    let totalFailed = dbJob.failedCount || 0

    // Process each keyword
    for (let i = startIndex; i < keywords.length; i++) {
      const keyword = keywords[i]

      console.log(`\n--- Processing keyword ${i + 1}/${keywords.length}: ${keyword} ---`)

      // Check if job was paused
      const currentJob = await prisma.job.findUnique({ where: { id: jobId } })
      if (currentJob?.status === 'PAUSED') {
        console.log(`Job ${jobId} was paused, stopping...`)
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

      // Process with or without locations
      if (locations && locations.length > 0) {
        for (const location of locations) {
          console.log(`\nSearching: "${keyword}" in "${location}"`)
          
          try {
            const places = await scraper.searchPlaces(keyword, location)
            const limitedPlaces = places.slice(0, maxResultsPerKeyword)

            console.log(`Got ${places.length} places, processing ${limitedPlaces.length}`)

            // Save to database
            for (let placeIndex = 0; placeIndex < limitedPlaces.length; placeIndex++) {
              const place = limitedPlaces[placeIndex]
              
              console.log(`\n>>> Saving place ${placeIndex + 1}/${limitedPlaces.length}: ${place.name}`)

              try {
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

                totalScraped++
                console.log(`✓ Saved successfully. Total: ${totalScraped}`)

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

                // Milestone notifications
                if (totalScraped % 500 === 0) {
                  try {
                    await notifyMilestone({
                      id: jobId,
                      clientName: dbJob.clientName,
                      scrapedCount: totalScraped,
                      totalEstimated: keywords.length * maxResultsPerKeyword,
                    })
                  } catch (error: any) {
                    console.log('Failed to send milestone notification:', error.message)
                  }
                }
              } catch (error: any) {
                if (error.code === 'P2002') {
                  console.log(`⚠ Duplicate place: ${place.name} (skipped)`)
                  continue
                }
                throw error
              }
            }

            console.log(`Completed scraping for "${keyword}" in "${location}"`)
          } catch (error: any) {
            if (error.message === 'CAPTCHA_DETECTED') {
              console.log('\n🚨 CAPTCHA DETECTED - Pausing job')
              
              await prisma.job.update({
                where: { id: jobId },
                data: {
                  status: 'PAUSED',
                  pauseReason: 'CAPTCHA detected',
                },
              })

              try {
                await notifyCaptchaDetected({
                  id: jobId,
                  clientName: dbJob.clientName,
                  scrapedCount: totalScraped,
                })
              } catch (notifyError: any) {
                console.log('Failed to send CAPTCHA notification:', notifyError.message)
              }

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

            console.error(`❌ Error scraping "${keyword}" in "${location}":`, error.message)

            await prisma.failedScrape.create({
              data: {
                jobId,
                keyword,
                location,
                errorType: error.name || 'UNKNOWN_ERROR',
                errorMessage: error.message || 'Unknown error occurred',
              },
            })

            totalFailed++

            await prisma.job.update({
              where: { id: jobId },
              data: { failedCount: totalFailed },
            })
          }
        }
      } else {
        // No locations specified
        console.log(`\nSearching: "${keyword}" (no location)`)
        
        try {
          const places = await scraper.searchPlaces(keyword)
          const limitedPlaces = places.slice(0, maxResultsPerKeyword)

          console.log(`Got ${places.length} places, processing ${limitedPlaces.length}`)

          for (let placeIndex = 0; placeIndex < limitedPlaces.length; placeIndex++) {
            const place = limitedPlaces[placeIndex]
            
            console.log(`\n>>> Saving place ${placeIndex + 1}/${limitedPlaces.length}: ${place.name}`)

            try {
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

              totalScraped++
              console.log(`✓ Saved successfully. Total: ${totalScraped}`)

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
                try {
                  await notifyMilestone({
                    id: jobId,
                    clientName: dbJob.clientName,
                    scrapedCount: totalScraped,
                    totalEstimated: keywords.length * maxResultsPerKeyword,
                  })
                } catch (error: any) {
                  console.log('Failed to send milestone notification:', error.message)
                }
              }
            } catch (error: any) {
              if (error.code === 'P2002') {
                console.log(`⚠ Duplicate place: ${place.name} (skipped)`)
                continue
              }
              throw error
            }
          }

          console.log(`Completed scraping for "${keyword}"`)
        } catch (error: any) {
          if (error.message === 'CAPTCHA_DETECTED') {
            console.log('\n🚨 CAPTCHA DETECTED - Pausing job')
            
            await prisma.job.update({
              where: { id: jobId },
              data: {
                status: 'PAUSED',
                pauseReason: 'CAPTCHA detected',
              },
            })

            try {
              await notifyCaptchaDetected({
                id: jobId,
                clientName: dbJob.clientName,
                scrapedCount: totalScraped,
              })
            } catch (notifyError: any) {
              console.log('Failed to send CAPTCHA notification:', notifyError.message)
            }

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

          console.error(`❌ Error scraping "${keyword}":`, error.message)

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
        }
      }
    }

    // Job completed successfully
    const completedAt = new Date()
    const startedAt = dbJob.startedAt || new Date()
    const duration = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)

    console.log(`\n========================================`)
    console.log(`✓ JOB COMPLETED`)
    console.log(`Total scraped: ${totalScraped}`)
    console.log(`Total failed: ${totalFailed}`)
    console.log(`Duration: ${duration} seconds`)
    console.log(`========================================\n`)

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

    try {
      await notifyJobCompleted({
        id: jobId,
        clientName: dbJob.clientName,
        scrapedCount: totalScraped,
        failedCount: totalFailed,
        duration,
      })
    } catch (error: any) {
      console.log('Failed to send completion notification:', error.message)
    }

    jobEvents.emit('job:completed', { jobId })

  } catch (error: any) {
    console.error(`\n❌ JOB FAILED: ${error.message}`)
    console.error(error.stack)

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
      try {
        await notifyJobFailed({
          id: jobId,
          clientName: dbJob.clientName,
          error: error.message || 'Unknown error',
          scrapedCount: dbJob.scrapedCount,
        })
      } catch (notifyError: any) {
        console.log('Failed to send failure notification:', notifyError.message)
      }
    }

    jobEvents.emit('job:failed', { jobId, error: error.message })

    throw error
  } finally {
    if (scraper) {
      console.log('Closing browser...')
      await scraper.close()
    }
  }
})

// Queue event handlers
scrapeQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`)
})

scrapeQueue.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err)
})

scrapeQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`)
})

console.log('Scrape worker started and listening for jobs...')