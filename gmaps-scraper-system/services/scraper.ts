import { Page } from 'puppeteer'
import { humanDelay, cooldownDelay } from '@/utils/delays'
import { applyStealthMeasures, detectCaptcha } from '@/utils/stealth'

const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())

export interface ScrapedPlaceData {
  placeId: string
  name: string
  address?: string
  city?: string
  rating?: number
  reviewsCount?: number
  phone?: string
  website?: string
  email?: string
  facebook?: string
  instagram?: string
  twitter?: string
  linkedin?: string
  plusCode?: string
  latitude?: number
  longitude?: number
  businessStatus?: string
  businessTypes?: string[]
  openingHours?: any
  about?: string
  amenities?: any
}

export class GoogleMapsScraper {
  private browser: any = null
  private page: Page | null = null
  private placesScrapedInSession = 0
  private sessionStartTime = Date.now()

  async initialize(): Promise<void> {
    console.log('Initializing browser...')

    this.browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-blink-features=AutomationControlled',
      ],
    })

    this.page = await this.browser.newPage()
    await applyStealthMeasures(this.page)

    console.log('Browser initialized successfully')
  }

  async checkAndRestartSession(): Promise<void> {
    const timeSinceStart = Date.now() - this.sessionStartTime
    const oneHour = 60 * 60 * 1000

    if (this.placesScrapedInSession >= 500 || timeSinceStart >= oneHour) {
      console.log('Restarting browser session for freshness...')
      await this.close()
      await this.initialize()
      this.placesScrapedInSession = 0
      this.sessionStartTime = Date.now()
    }
  }

  async searchPlaces(
    keyword: string,
    location?: string
  ): Promise<ScrapedPlaceData[]> {
    if (!this.page) {
      throw new Error('Browser not initialized')
    }

    const searchQuery = location ? `${keyword} in ${location}` : keyword
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`

    console.log(`Searching for: ${searchQuery}`)

    try {
      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      })

      if (await detectCaptcha(this.page)) {
        throw new Error('CAPTCHA_DETECTED')
      }

      await this.page.waitForSelector('[role="feed"]', { timeout: 10000 })
      await this.scrollResults()
      const placeLinks = await this.extractPlaceLinks()

      console.log(`Found ${placeLinks.length} places for "${searchQuery}"`)

      const scrapedData: ScrapedPlaceData[] = []

      for (const link of placeLinks) {
        try {
          await this.checkAndRestartSession()
          await humanDelay()

          if (await detectCaptcha(this.page!)) {
            throw new Error('CAPTCHA_DETECTED')
          }

          const placeData = await this.scrapePlaceDetails(link)

          if (placeData) {
            scrapedData.push(placeData)
            this.placesScrapedInSession++

            if (scrapedData.length % 50 === 0) {
              await cooldownDelay()
            }
          }
        } catch (error: any) {
          if (error.message === 'CAPTCHA_DETECTED') {
            throw error
          }
          console.error(`Error scraping place:`, error.message)
          continue
        }
      }

      return scrapedData
    } catch (error: any) {
      if (error.message === 'CAPTCHA_DETECTED') {
        throw error
      }
      console.error(`Error searching:`, error.message)
      throw error
    }
  }

  private async scrollResults(): Promise<void> {
    if (!this.page) return

    try {
      const feedSelector = '[role="feed"]'

      for (let i = 0; i < 10; i++) {
        await this.page.evaluate((selector) => {
          const feed = document.querySelector(selector)
          if (feed) {
            feed.scrollTop = feed.scrollHeight
          }
        }, feedSelector)

        await humanDelay(1000, 2000)

        const endOfResults = await this.page.evaluate(() => {
          const text = document.body.innerText
          return text.includes("You've reached the end")
        })

        if (endOfResults) break
      }
    } catch (error) {
      console.error('Error scrolling:', error)
    }
  }

  private async extractPlaceLinks(): Promise<string[]> {
    if (!this.page) return []

    try {
      return await this.page.evaluate(() => {
        const links: string[] = []
        const elements = document.querySelectorAll('a[href*="/maps/place/"]')

        elements.forEach((el) => {
          const href = el.getAttribute('href')
          if (href && !links.includes(href)) {
            links.push(href)
          }
        })

        return links
      })
    } catch (error) {
      return []
    }
  }

  private async scrapePlaceDetails(placeLink: string): Promise<ScrapedPlaceData | null> {
    if (!this.page) return null

    try {
      const fullUrl = placeLink.startsWith('http')
        ? placeLink
        : `https://www.google.com${placeLink}`

      await this.page.goto(fullUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      await humanDelay(1000, 2000)

      const placeId = await this.extractPlaceId()
      if (!placeId) {
        return null
      }

      const data = await this.page.evaluate(() => {
        const nameEl = document.querySelector('h1')
        const name = nameEl?.textContent?.trim() || ''

        const addressButton = document.querySelector('button[data-item-id="address"]')
        const address = addressButton?.getAttribute('aria-label')?.replace('Address: ', '')

        const ratingEl = document.querySelector('[role="img"][aria-label*="star"]')
        const ratingText = ratingEl?.getAttribute('aria-label') || ''
        const ratingMatch = ratingText.match(/[\d.]+/)
        const rating = ratingMatch ? parseFloat(ratingMatch[0]) : undefined

        const reviewsEl = Array.from(document.querySelectorAll('button')).find(
          (btn: Element) => btn.getAttribute('aria-label')?.includes('reviews')
        )
        const reviewsText = reviewsEl?.getAttribute('aria-label') || ''
        const reviewsMatch = reviewsText.match(/[\d,]+/)
        const reviewsCount = reviewsMatch ? parseInt(reviewsMatch[0].replace(/,/g, '')) : undefined

        const phoneButton = Array.from(document.querySelectorAll('button[data-item-id]')).find(
          (btn: Element) => btn.getAttribute('data-item-id')?.includes('phone')
        )
        const phone = phoneButton?.getAttribute('aria-label')?.replace('Phone: ', '')

        const websiteLink = Array.from(document.querySelectorAll('a[data-item-id]')).find(
          (link: Element) => link.getAttribute('data-item-id')?.includes('authority')
        ) as HTMLAnchorElement | undefined
        const website = websiteLink?.href

        const businessStatus = document.body.innerText.includes('Closed') ? 'CLOSED' : 'OPERATIONAL'

        const typeButton = document.querySelector('button[jsaction*="category"]')
        const businessTypes = typeButton?.textContent?.trim() ? [typeButton.textContent.trim()] : undefined

        const plusCodeButton = Array.from(document.querySelectorAll('button[data-item-id]')).find(
          (btn: Element) => btn.getAttribute('data-item-id')?.includes('plus_code')
        )
        const plusCode = plusCodeButton?.getAttribute('aria-label')?.replace('Plus code: ', '')

        const aboutSection = document.querySelector('[aria-label*="About"]')
        const about = aboutSection?.textContent?.trim()

        const allLinks = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
        const facebook = allLinks.find(a => a.href.includes('facebook.com'))?.href
        const instagram = allLinks.find(a => a.href.includes('instagram.com'))?.href
        const twitter = allLinks.find(a => a.href.includes('twitter.com') || a.href.includes('x.com'))?.href
        const linkedin = allLinks.find(a => a.href.includes('linkedin.com'))?.href
        
        const emailLink = allLinks.find(a => a.href.startsWith('mailto:'))
        const email = emailLink?.href.replace('mailto:', '')

        return {
          name,
          address,
          rating,
          reviewsCount,
          phone,
          website,
          businessStatus,
          businessTypes,
          plusCode,
          about,
          facebook,
          instagram,
          twitter,
          linkedin,
          email,
        }
      })

      const coordinates = this.extractCoordinates(this.page.url())

      return {
        placeId,
        name: data.name,
        address: data.address,
        rating: data.rating,
        reviewsCount: data.reviewsCount,
        phone: data.phone,
        website: data.website,
        businessStatus: data.businessStatus,
        businessTypes: data.businessTypes,
        plusCode: data.plusCode,
        about: data.about,
        facebook: data.facebook,
        instagram: data.instagram,
        twitter: data.twitter,
        linkedin: data.linkedin,
        email: data.email,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }
    } catch (error: any) {
      console.error('Error scraping place details:', error.message)
      return null
    }
  }

  private async extractPlaceId(): Promise<string | null> {
    if (!this.page) return null

    try {
      const url = this.page.url()
      const match = url.match(/!1s([^!]+)/)
      return match ? match[1] : null
    } catch (error) {
      return null
    }
  }

  private extractCoordinates(url: string): { latitude?: number; longitude?: number } {
    try {
      const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        }
      }
    } catch (error) {
      // ignore
    }
    return {}
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}