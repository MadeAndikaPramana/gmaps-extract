'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Job {
  id: string
  clientName: string
  status: string
  scrapedCount: number
  failedCount: number
  keywords: string[]
  maxResultsPerKeyword: number
  createdAt: string
  completedAt: string | null
  _count: {
    scrapedPlaces: number
    failedScrapes: number
  }
}

export default function JobsListPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchJobs()
  }, [filter])

  const fetchJobs = async () => {
    try {
      const url = filter === 'all' ? '/api/jobs' : `/api/jobs?status=${filter}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setJobs(data.data)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
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

    const colors: Record<string, string> = {
      RUNNING: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PAUSED: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || ''}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">All Jobs</h1>
              <p className="mt-1 text-sm text-gray-500">
                View and manage all scraping jobs
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'RUNNING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('RUNNING')}
          >
            Running
          </Button>
          <Button
            variant={filter === 'PENDING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('PENDING')}
          >
            Pending
          </Button>
          <Button
            variant={filter === 'COMPLETED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('COMPLETED')}
          >
            Completed
          </Button>
          <Button
            variant={filter === 'FAILED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('FAILED')}
          >
            Failed
          </Button>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              {jobs.length} {filter === 'all' ? 'total' : filter.toLowerCase()} jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No jobs found</p>
                <Link href="/dashboard/new">
                  <Button variant="outline" className="mt-4">
                    Create New Job
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Keywords
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{job.clientName}</div>
                          <div className="text-xs text-gray-500">ID: {job.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getStatusBadge(job.status)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {job._count.scrapedPlaces.toLocaleString()} scraped
                          </div>
                          <div className="text-xs text-gray-500">
                            {job._count.failedScrapes} failed
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {Array.isArray(job.keywords) ? job.keywords.length : 0} keywords
                          </div>
                          <div className="text-xs text-gray-500">
                            Max {job.maxResultsPerKeyword} per keyword
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/dashboard/jobs/${job.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </Link>
                            {job.status === 'COMPLETED' && job._count.scrapedPlaces > 0 && (
                              <a href={`/api/jobs/${job.id}/export`} download>
                                <Button variant="outline" size="sm">
                                  <Download className="w-4 h-4 mr-1" />
                                  CSV
                                </Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
