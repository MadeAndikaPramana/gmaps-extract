import { NextRequest, NextResponse } from 'next/server'
import { generateCSV, getExportPath } from '@/services/export'
import { readFileSync } from 'fs'

// GET /api/jobs/[id]/export - Export job data to CSV
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Generate CSV
    const filename = await generateCSV({ jobId: params.id })

    // Get file path
    const filepath = await getExportPath(filename)

    // Read file
    const fileBuffer = readFileSync(filepath)

    // Return file as download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting job:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
