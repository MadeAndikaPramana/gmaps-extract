'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, X } from 'lucide-react'

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    clientName: '',
    keywords: [''],
    locations: [''],
    maxResultsPerKeyword: 500,
    minDelay: 2000, // Optimized for speed with 3 concurrent workers
    maxDelay: 4000, // Optimized for speed with 3 concurrent workers
    cooldownAfter: 50,
    cooldownDuration: 60000, // Optimized for better throughput
    fieldsToScrape: {
      phone: true,
      rating: true,
      city: true,
      businessInfo: true,
      coordinates: true,
      socialMedia: false, // Rarely available on Google Maps
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Filter out empty keywords and locations
      const keywords = formData.keywords.filter((k) => k.trim())
      const locations = formData.locations.filter((l) => l.trim())

      if (keywords.length === 0) {
        setError('Please add at least one keyword')
        setLoading(false)
        return
      }

      // Convert fieldsToScrape object to array
      const fieldsToScrapeArray = Object.entries(formData.fieldsToScrape)
        .filter(([_, enabled]) => enabled)
        .map(([field, _]) => field)

      const payload = {
        clientName: formData.clientName,
        keywords,
        locations: locations.length > 0 ? locations : undefined,
        maxResultsPerKeyword: formData.maxResultsPerKeyword,
        minDelay: formData.minDelay,
        maxDelay: formData.maxDelay,
        cooldownAfter: formData.cooldownAfter,
        cooldownDuration: formData.cooldownDuration,
        fieldsToScrape: fieldsToScrapeArray,
      }

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create job')
      }

      // Redirect to job details
      router.push(`/dashboard/jobs/${data.data.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const addKeyword = () => {
    setFormData({
      ...formData,
      keywords: [...formData.keywords, ''],
    })
  }

  const removeKeyword = (index: number) => {
    const newKeywords = formData.keywords.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      keywords: newKeywords.length > 0 ? newKeywords : [''],
    })
  }

  const updateKeyword = (index: number, value: string) => {
    const newKeywords = [...formData.keywords]
    newKeywords[index] = value
    setFormData({ ...formData, keywords: newKeywords })
  }

  const addLocation = () => {
    setFormData({
      ...formData,
      locations: [...formData.locations, ''],
    })
  }

  const removeLocation = (index: number) => {
    const newLocations = formData.locations.filter((_, i) => i !== index)
    setFormData({ ...formData, locations: newLocations })
  }

  const updateLocation = (index: number, value: string) => {
    const newLocations = [...formData.locations]
    newLocations[index] = value
    setFormData({ ...formData, locations: newLocations })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Job</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure and start a new scraping job
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the client details and scraping parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.clientName}
                    onChange={(e) =>
                      setFormData({ ...formData, clientName: e.target.value })
                    }
                    placeholder="e.g., Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Results Per Keyword
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.maxResultsPerKeyword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxResultsPerKeyword: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum number of places to scrape per keyword
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Keywords */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Keywords *</CardTitle>
                    <CardDescription>
                      Add search keywords to scrape (e.g., "restaurants", "coffee shops")
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Keyword
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {formData.keywords.map((keyword, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      required
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={keyword}
                      onChange={(e) => updateKeyword(index, e.target.value)}
                      placeholder="e.g., coffee shops"
                    />
                    {formData.keywords.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeKeyword(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Locations (Optional) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Locations (Optional)</CardTitle>
                    <CardDescription>
                      Add specific locations to search in (e.g., "New York, NY", "London, UK")
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLocation}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {formData.locations.map((location, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={location}
                      onChange={(e) => updateLocation(index, e.target.value)}
                      placeholder="e.g., New York, NY"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLocation(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Fields to Scrape */}
            <Card>
              <CardHeader>
                <CardTitle>Fields to Scrape</CardTitle>
                <CardDescription>
                  Select which data fields to extract. Name, Address, Website, and Place ID are always included.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="phone"
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.fieldsToScrape.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fieldsToScrape: { ...formData.fieldsToScrape, phone: e.target.checked },
                        })
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor="phone" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Phone Number
                      </label>
                      <p className="text-xs text-gray-500">70-80% availability on Google Maps</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="rating"
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.fieldsToScrape.rating}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fieldsToScrape: { ...formData.fieldsToScrape, rating: e.target.checked },
                        })
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor="rating" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Rating & Reviews Count
                      </label>
                      <p className="text-xs text-gray-500">90% availability on Google Maps</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="city"
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.fieldsToScrape.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fieldsToScrape: { ...formData.fieldsToScrape, city: e.target.checked },
                        })
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor="city" className="text-sm font-medium text-gray-700 cursor-pointer">
                        City
                      </label>
                      <p className="text-xs text-gray-500">Extracted from address - 70%+ availability</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="businessInfo"
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.fieldsToScrape.businessInfo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fieldsToScrape: { ...formData.fieldsToScrape, businessInfo: e.target.checked },
                        })
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor="businessInfo" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Business Status & Type
                      </label>
                      <p className="text-xs text-gray-500">60-80% availability on Google Maps</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="coordinates"
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.fieldsToScrape.coordinates}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fieldsToScrape: { ...formData.fieldsToScrape, coordinates: e.target.checked },
                        })
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor="coordinates" className="text-sm font-medium text-gray-700 cursor-pointer">
                        GPS Coordinates (Latitude/Longitude)
                      </label>
                      <p className="text-xs text-gray-500">95%+ availability on Google Maps</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="socialMedia"
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.fieldsToScrape.socialMedia}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fieldsToScrape: { ...formData.fieldsToScrape, socialMedia: e.target.checked },
                        })
                      }
                    />
                    <div className="flex-1">
                      <label htmlFor="socialMedia" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Social Media Links (Facebook, Instagram, etc.)
                      </label>
                      <p className="text-xs text-gray-500">
                        10-15% availability on Google Maps (not recommended - better obtained from websites)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Configure delay and cooldown parameters for safer scraping
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Delay (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      max="10000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.minDelay}
                      onChange={(e) =>
                        setFormData({ ...formData, minDelay: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Delay (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      max="10000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.maxDelay}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDelay: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cooldown After (items)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.cooldownAfter}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cooldownAfter: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cooldown Duration (ms)
                    </label>
                    <input
                      type="number"
                      min="30000"
                      max="300000"
                      step="1000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.cooldownDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cooldownDuration: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Recommended settings:</strong> Keep delays between 3-5 seconds for
                    safe scraping. The system will automatically pause for{' '}
                    {formData.cooldownDuration / 1000} seconds after every{' '}
                    {formData.cooldownAfter} items.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
                size="lg"
              >
                {loading ? 'Creating Job...' : 'Create Job'}
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="outline" size="lg">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
