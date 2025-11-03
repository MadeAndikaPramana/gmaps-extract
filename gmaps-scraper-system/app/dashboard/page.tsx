'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Activity, FileText, TrendingUp, AlertCircle, Plus } from 'lucide-react'

interface Stats {
  jobs: {
    active: number
    today: number
    total: number
    completed: number
    failed: number
  }
  places: {
    today: number
    total: number
  }
  system: {
    status: string
  }
  activeJobs: Array<{
    id: string
    clientName: string
    status: string
    scrapedCount: number
    failedCount: number
    currentKeyword: string | null
    keywords: string[]
    maxResultsPerKeyword: number
    createdAt: string
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobUpdates, setJobUpdates] = useState<Record<string, any>>({})

  // Fetch initial stats
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Connect to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/sse')

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'progress' || data.type === 'status') {
        setJobUpdates((prev) => ({
          ...prev,
          [data.jobId]: data,
        }))
      } else if (data.type === 'completed' || data.type === 'failed') {
        // Refresh stats when job completes or fails
        fetchStats()
      }
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      RUNNING: 'default',
      PENDING: 'secondary',
      PAUSED: 'secondary',
      COMPLETED: 'secondary',
      FAILED: 'destructive',
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  const getProgress = (job: any) => {
    const updates = jobUpdates[job.id]
    const keywords = Array.isArray(job.keywords) ? job.keywords : []
    const totalExpected = keywords.length * job.maxResultsPerKeyword
    const scrapedCount = updates?.scrapedCount || job.scrapedCount
    return totalExpected > 0 ? (scrapedCount / totalExpected) * 100 : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Google Maps Scraper Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor and manage your scraping jobs
              </p>
            </div>
            <Link href="/dashboard/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Job
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.jobs.active || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.jobs.today || 0} created today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.jobs.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.jobs.completed || 0} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Places Scraped</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.places.total.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.places.today.toLocaleString() || 0} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {stats?.system.status || 'Unknown'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.jobs.failed || 0} failed jobs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Jobs */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Active Jobs</CardTitle>
            <CardDescription>
              Currently running and pending jobs with real-time progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.activeJobs && stats.activeJobs.length > 0 ? (
              <div className="space-y-6">
                {stats.activeJobs.map((job) => {
                  const updates = jobUpdates[job.id]
                  const progress = getProgress(job)
                  const scrapedCount = updates?.scrapedCount || job.scrapedCount
                  const currentKeyword = updates?.currentKeyword || job.currentKeyword

                  return (
                    <div
                      key={job.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{job.clientName}</h3>
                          <p className="text-sm text-gray-500">
                            {Array.isArray(job.keywords) ? job.keywords.length : 0} keywords
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(job.status)}
                          <Link href={`/dashboard/jobs/${job.id}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">
                            {scrapedCount.toLocaleString()} scraped
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{progress.toFixed(1)}% complete</span>
                          {currentKeyword && (
                            <span>Current: {currentKeyword}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active jobs</p>
                <Link href="/dashboard/new">
                  <Button variant="outline" className="mt-4">
                    Create New Job
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/jobs">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">View All Jobs</CardTitle>
                <CardDescription>
                  Browse and manage all scraping jobs
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/new">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Create New Job</CardTitle>
                <CardDescription>
                  Start a new scraping job with custom parameters
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-50">
            <CardHeader>
              <CardTitle className="text-lg">System Logs</CardTitle>
              <CardDescription>
                View system events and error logs
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
