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

  // Define CSV headers
  const headers = [
    { id: 'name', title: 'Name' },
    { id: 'address', title: 'Address' },
    { id: 'city', title: 'City' },
    { id: 'rating', title: 'Rating' },
    { id: 'reviewsCount', title: 'Reviews Count' },
    { id: 'phone', title: 'Phone' },
    { id: 'website', title: 'Website' },
    { id: 'email', title: 'Email' },
    { id: 'facebook', title: 'Facebook' },
    { id: 'instagram', title: 'Instagram' },
    { id: 'twitter', title: 'Twitter' },
    { id: 'linkedin', title: 'LinkedIn' },
    { id: 'plusCode', title: 'Plus Code' },
    { id: 'latitude', title: 'Latitude' },
    { id: 'longitude', title: 'Longitude' },
    { id: 'businessStatus', title: 'Business Status' },
    { id: 'businessTypes', title: 'Business Types' },
    { id: 'openingHours', title: 'Opening Hours' },
    { id: 'about', title: 'About' },
    { id: 'placeId', title: 'Place ID' },
  ]

  // Create CSV writer
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: headers,
  })

  // Transform data for CSV
  const records = places.map((place) => ({
    name: place.name || '',
    address: place.address || '',
    city: place.city || '',
    rating: place.rating?.toString() || '',
    reviewsCount: place.reviewsCount?.toString() || '',
    phone: place.phone || '',
    website: place.website || '',
    email: place.email || '',
    facebook: place.facebook || '',
    instagram: place.instagram || '',
    twitter: place.twitter || '',
    linkedin: place.linkedin || '',
    plusCode: place.plusCode || '',
    latitude: place.latitude?.toString() || '',
    longitude: place.longitude?.toString() || '',
    businessStatus: place.businessStatus || '',
    businessTypes:
      place.businessTypes && Array.isArray(place.businessTypes)
        ? (place.businessTypes as string[]).join(', ')
        : '',
    openingHours:
      place.openingHours && typeof place.openingHours === 'object'
        ? JSON.stringify(place.openingHours)
        : '',
    about: place.about || '',
    placeId: place.placeId || '',
  }))

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
