'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Download, Pause, Play, RefreshCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface JobDetail {
  id: string
  clientName: string
  status: string
  keywords: string[]
  locations: string[] | null
  maxResultsPerKeyword: number
  scrapedCount: number
  failedCount: number
  currentKeyword: string | null
  currentKeywordIndex: number
  startedAt: string | null
  completedAt: string | null
  estimatedDuration: number | null
  pauseReason: string | null
  errorMessage: string | null
  createdAt: string
  scrapedPlaces: Array<{
    id: string
    name: string
    address: string | null
    rating: number | null
    phone: string | null
    website: string | null
    scrapedAt: string
  }>
  failedScrapes: Array<{
    id: string
    keyword: string
    location: string | null
    errorType: string
    errorMessage: string
    failedAt: string
  }>
  systemLogs: Array<{
    id: string
    level: string
    event: string
    message: string
    createdAt: string
  }>
  _count: {
    scrapedPlaces: number
    failedScrapes: number
  }
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchJob()
    const interval = setInterval(fetchJob, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [jobId])

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      const data = await response.json()

      if (data.success) {
        setJob(data.data)
      }
    } catch (error) {
      console.error('Error fetching job:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePause = async () => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/pause`, {
        method: 'PATCH',
      })
      const data = await response.json()
      if (data.success) {
        await fetchJob()
      }
    } catch (error) {
      console.error('Error pausing job:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResume = async () => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/resume`, {
        method: 'PATCH',
      })
      const data = await response.json()
      if (data.success) {
        await fetchJob()
      }
    } catch (error) {
      console.error('Error resuming job:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job? This will permanently delete all scraped data and cannot be undone.')) {
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        router.push('/dashboard/jobs')
      } else {
        alert('Failed to delete job: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting job:', error)
      alert('Failed to delete job')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      RUNNING: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PAUSED: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[status] || ''}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading job details...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Job not found</p>
      </div>
    )
  }

  const progress =
    job.keywords.length > 0
      ? ((job.currentKeywordIndex + 1) / job.keywords.length) * 100
      : 0
  const totalExpected = job.keywords.length * job.maxResultsPerKeyword

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/jobs">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Jobs
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{job.clientName}</h1>
                <p className="mt-1 text-sm text-gray-500">Job ID: {job.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(job.status)}
              {job.status === 'RUNNING' && (
                <Button
                  onClick={handlePause}
                  disabled={actionLoading}
                  variant="outline"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              {job.status === 'PAUSED' && (
                <Button
                  onClick={handleResume}
                  disabled={actionLoading}
                  variant="outline"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              {job.status === 'COMPLETED' && job._count.scrapedPlaces > 0 && (
                <a href={`/api/jobs/${job.id}/export`} download>
                  <Button>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                  </Button>
                </a>
              )}
              <Button
                onClick={handleDelete}
                disabled={actionLoading}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Job
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Progress Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">
                    {job.scrapedCount.toLocaleString()} / ~{totalExpected.toLocaleString()} places
                  </span>
                  <span className="text-sm text-gray-500">
                    {job.currentKeyword || 'Waiting to start...'}
                  </span>
                </div>
                <Progress value={(job.scrapedCount / totalExpected) * 100} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Scraped</p>
                  <p className="text-2xl font-bold">{job.scrapedCount.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold">{job.failedCount}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Keywords</p>
                  <p className="text-2xl font-bold">
                    {job.currentKeywordIndex + 1} / {job.keywords.length}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="text-2xl font-bold">
                    {job.startedAt
                      ? formatDistanceToNow(new Date(job.startedAt))
                      : 'Not started'}
                  </p>
                </div>
              </div>

              {job.pauseReason && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-orange-800">
                    Pause Reason: {job.pauseReason}
                  </p>
                </div>
              )}

              {job.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800">
                    Error: {job.errorMessage}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Job Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-gray-600">Keywords</dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-1">
                      {job.keywords.map((keyword, i) => (
                        <Badge key={i} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </dd>
                </div>
                {job.locations && job.locations.length > 0 && (
                  <div>
                    <dt className="font-medium text-gray-600">Locations</dt>
                    <dd className="mt-1">
                      <div className="flex flex-wrap gap-1">
                        {job.locations.map((location, i) => (
                          <Badge key={i} variant="secondary">
                            {location}
                          </Badge>
                        ))}
                      </div>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-gray-600">Max Results Per Keyword</dt>
                  <dd className="mt-1">{job.maxResultsPerKeyword}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-600">Created</dt>
                  <dd className="mt-1">
                    {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Recent Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {job.systemLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="text-sm border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.level === 'ERROR'
                            ? 'destructive'
                            : log.level === 'WARNING'
                            ? 'secondary'
                            : 'default'
                        }
                      >
                        {log.level}
                      </Badge>
                      <span className="font-medium">{log.event}</span>
                    </div>
                    <p className="text-gray-600 mt-1">{log.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recently Scraped Places */}
        {job.scrapedPlaces.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Recently Scraped Places</CardTitle>
              <CardDescription>
                Showing {job.scrapedPlaces.length} most recent (Total:{' '}
                {job._count.scrapedPlaces.toLocaleString()})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Address</th>
                      <th className="px-4 py-2 text-left">Rating</th>
                      <th className="px-4 py-2 text-left">Phone</th>
                      <th className="px-4 py-2 text-left">Scraped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {job.scrapedPlaces.map((place) => (
                      <tr key={place.id}>
                        <td className="px-4 py-2 font-medium">{place.name}</td>
                        <td className="px-4 py-2 text-gray-600">{place.address || '-'}</td>
                        <td className="px-4 py-2">{place.rating || '-'}</td>
                        <td className="px-4 py-2">{place.phone || '-'}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {formatDistanceToNow(new Date(place.scrapedAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed Scrapes */}
        {job.failedScrapes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Failed Scrapes</CardTitle>
              <CardDescription>
                Showing {job.failedScrapes.length} most recent failures (Total:{' '}
                {job._count.failedScrapes})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.failedScrapes.map((failure) => (
                  <div key={failure.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="destructive">{failure.errorType}</Badge>
                      <span className="font-medium">{failure.keyword}</span>
                      {failure.location && (
                        <span className="text-sm text-gray-500">in {failure.location}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{failure.errorMessage}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(failure.failedAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
