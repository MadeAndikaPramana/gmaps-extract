import { createObjectCsvWriter } from 'csv-writer'
import { prisma } from '@/lib/prisma'
import path from 'path'
import fs from 'fs'

export interface ExportOptions {
  jobId: string
  includeAllFields?: boolean
}

export async function generateCSV(options: ExportOptions): Promise<string> {
  const { jobId, includeAllFields = true } = options

  // Get job to check fieldsToScrape configuration
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) {
    throw new Error('Job not found')
  }

  const fieldsToScrape = (job.fieldsToScrape as string[]) || []

  // Get all scraped places for this job
  const places = await prisma.scrapedPlace.findMany({
    where: { jobId },
    orderBy: { scrapedAt: 'asc' },
  })

  if (places.length === 0) {
    throw new Error('No data to export')
  }

  // Ensure exports directory exists
  const exportsDir = path.join(process.cwd(), 'exports')
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true })
  }

  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `job_${jobId}_${timestamp}.csv`
  const filepath = path.join(exportsDir, filename)

  // Define CSV headers - always include basic fields
  const headers = [
    { id: 'name', title: 'Name' },
    { id: 'address', title: 'Address' },
    { id: 'website', title: 'Website' },
    { id: 'placeId', title: 'Place ID' },
  ]

  // Add optional fields based on job configuration
  if (fieldsToScrape.includes('city')) {
    headers.push({ id: 'city', title: 'City' })
  }
  if (fieldsToScrape.includes('rating')) {
    headers.push({ id: 'rating', title: 'Rating' })
    headers.push({ id: 'reviewsCount', title: 'Reviews Count' })
  }
  if (fieldsToScrape.includes('phone')) {
    headers.push({ id: 'phone', title: 'Phone' })
  }
  if (fieldsToScrape.includes('coordinates')) {
    headers.push({ id: 'latitude', title: 'Latitude' })
    headers.push({ id: 'longitude', title: 'Longitude' })
  }
  if (fieldsToScrape.includes('businessInfo')) {
    headers.push({ id: 'businessStatus', title: 'Business Status' })
    headers.push({ id: 'businessTypes', title: 'Business Types' })
  }
  if (fieldsToScrape.includes('socialMedia')) {
    headers.push({ id: 'facebook', title: 'Facebook' })
    headers.push({ id: 'instagram', title: 'Instagram' })
    headers.push({ id: 'twitter', title: 'Twitter' })
    headers.push({ id: 'linkedin', title: 'LinkedIn' })
  }

  // Create CSV writer
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: headers,
  })

  // Transform data for CSV - only include selected fields
  const records = places.map((place) => {
    const record: any = {
      name: place.name || '',
      address: place.address || '',
      website: place.website || '',
      placeId: place.placeId || '',
    }

    // Add optional fields based on job configuration
    if (fieldsToScrape.includes('city')) {
      record.city = place.city || ''
    }
    if (fieldsToScrape.includes('rating')) {
      record.rating = place.rating?.toString() || ''
      record.reviewsCount = place.reviewsCount?.toString() || ''
    }
    if (fieldsToScrape.includes('phone')) {
      record.phone = place.phone || ''
    }
    if (fieldsToScrape.includes('coordinates')) {
      record.latitude = place.latitude?.toString() || ''
      record.longitude = place.longitude?.toString() || ''
    }
    if (fieldsToScrape.includes('businessInfo')) {
      record.businessStatus = place.businessStatus || ''
      record.businessTypes =
        place.businessTypes && Array.isArray(place.businessTypes)
          ? (place.businessTypes as string[]).join(', ')
          : ''
    }
    if (fieldsToScrape.includes('socialMedia')) {
      record.facebook = place.facebook || ''
      record.instagram = place.instagram || ''
      record.twitter = place.twitter || ''
      record.linkedin = place.linkedin || ''
    }

    return record
  })

  // Write CSV
  await csvWriter.writeRecords(records)

  console.log(`CSV exported successfully: ${filename}`)

  return filename
}

export async function getExportPath(filename: string): Promise<string> {
  const exportsDir = path.join(process.cwd(), 'exports')
  const filepath = path.join(exportsDir, filename)

  if (!fs.existsSync(filepath)) {
    throw new Error('Export file not found')
  }

  return filepath
}

export async function deleteExport(filename: string): Promise<void> {
  const filepath = await getExportPath(filename)
  fs.unlinkSync(filepath)
}

export async function listExports(): Promise<string[]> {
  const exportsDir = path.join(process.cwd(), 'exports')

  if (!fs.existsSync(exportsDir)) {
    return []
  }

  return fs.readdirSync(exportsDir).filter((file) => file.endsWith('.csv'))
}
