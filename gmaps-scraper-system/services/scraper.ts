import puppeteer, { Browser, Page } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { applyStealthMeasures, detectCaptcha } from '@/utils/stealth'
import { humanDelay, cooldownDelay } from '@/utils/delays'

// Apply stealth plugin
const puppeteerExtra = require('puppeteer-extra')
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
  private browser: Browser | null = null
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
    const thirtyMinutes = 30 * 60 * 1000

    // Restart browser every 300 places or 30 minutes (more frequent for 3 concurrent workers)
    if (this.placesScrapedInSession >= 300 || timeSinceStart >= thirtyMinutes) {
      console.log('⟳ Restarting browser session for freshness...')
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

      // Check for CAPTCHA
      if (await detectCaptcha(this.page)) {
        throw new Error('CAPTCHA_DETECTED')
      }

      // Wait for results to load
      await this.page.waitForSelector('[role="feed"]', { timeout: 10000 })

      // Scroll to load more results
      await this.scrollResults()

      // Get all place links
      const placeLinks = await this.extractPlaceLinks()

      console.log(`Found ${placeLinks.length} places for "${searchQuery}"`)

      const scrapedData: ScrapedPlaceData[] = []

      for (const link of placeLinks) {
        try {
          // Check session health
          await this.checkAndRestartSession()

          // Human-like delay between places
          await humanDelay()

          // Check for CAPTCHA before each scrape
          if (await detectCaptcha(this.page!)) {
            throw new Error('CAPTCHA_DETECTED')
          }

          const placeData = await this.scrapePlaceDetails(link)

          if (placeData) {
            scrapedData.push(placeData)
            this.placesScrapedInSession++

            // Cooldown every 50 items
            if (scrapedData.length % 50 === 0) {
              await cooldownDelay()
            }
          }
        } catch (error: any) {
          if (error.message === 'CAPTCHA_DETECTED') {
            throw error
          }
          console.error(`Error scraping place ${link}:`, error)
          continue
        }
      }

      return scrapedData
    } catch (error: any) {
      if (error.message === 'CAPTCHA_DETECTED') {
        throw error
      }
      console.error(`Error searching for "${searchQuery}":`, error)
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

        // Check if we've reached the end
        const endOfResults = await this.page.evaluate(() => {
          const text = document.body.innerText
          return text.includes("You've reached the end of the list")
        })

        if (endOfResults) break
      }
    } catch (error) {
      console.error('Error scrolling results:', error)
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
      console.error('Error extracting place links:', error)
      return []
    }
  }

  private async scrapePlaceDetails(
    placeLink: string
  ): Promise<ScrapedPlaceData | null> {
    if (!this.page) return null

    try {
      const fullUrl = placeLink.startsWith('http')
        ? placeLink
        : `https://www.google.com${placeLink}`

      await this.page.goto(fullUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      })

      // Wait for place details to load
      await this.page.waitForSelector('h1', { timeout: 10000 })

      // Extract place ID from URL
      const placeId = await this.extractPlaceId()

      if (!placeId) {
        console.error('Could not extract place ID')
        return null
      }

      // Extract all data. Use a raw string evaluate to avoid bundler/runtime helper
      // injections (some bundlers inject helpers like `__name` which are not
      // available in the page context and cause ReferenceError). Passing a
      // plain string keeps the code executed inside the page clean.
      const data = await (this.page as any).evaluate(`(() => {
        function getText(selector) {
          const el = document.querySelector(selector);
          return el && el.textContent ? el.textContent.trim() : undefined;
        }

        function getAttribute(selector, attr) {
          const el = document.querySelector(selector);
          return el ? el.getAttribute(attr) : undefined;
        }

        // Name
        const name = getText('h1') || undefined;

        // Address
        const addressButton = Array.from(document.querySelectorAll('button[data-item-id]')).find(btn =>
          btn.getAttribute('data-item-id') && btn.getAttribute('data-item-id').includes('address')
        );
        const address = addressButton && addressButton.getAttribute('aria-label')
          ? addressButton.getAttribute('aria-label').replace('Address: ', '')
          : undefined;

        // Rating and reviews
        const ratingText = getText('[role="img"][aria-label*="stars"]');
        const rating = ratingText ? parseFloat(ratingText.split(' ')[0]) : undefined;
        const reviewsText = getText('[role="img"][aria-label*="reviews"]');
        const reviewsCount = reviewsText
          ? parseInt((reviewsText.match(/[\\d,]+/) || ['0'])[0].replace(/,/g, ''))
          : undefined;

        // Phone
        const phoneButton = Array.from(document.querySelectorAll('button[data-item-id]')).find(btn =>
          btn.getAttribute('data-item-id') && btn.getAttribute('data-item-id').includes('phone')
        );
        const phone = phoneButton && phoneButton.getAttribute('aria-label')
          ? phoneButton.getAttribute('aria-label').replace('Phone: ', '')
          : undefined;

        // Website
        const websiteLink = Array.from(document.querySelectorAll('a[data-item-id]')).find(link =>
          link.getAttribute('data-item-id') && link.getAttribute('data-item-id').includes('authority')
        );
        const website = websiteLink ? websiteLink.href : undefined;

        // Business status
        const statusEl = document.querySelector('[class*=\"operational\"]');
        const businessStatus = statusEl && statusEl.textContent ? statusEl.textContent.trim() : undefined;

        // Business types
        const typeButton = document.querySelector('button[jsaction*=\"category\"]');
        const businessTypesText = typeButton && typeButton.textContent ? typeButton.textContent.trim() : undefined;

        // Plus code
        const plusCodeButton = Array.from(document.querySelectorAll('button[data-item-id]')).find(btn =>
          btn.getAttribute('data-item-id') && btn.getAttribute('data-item-id').includes('plus_code')
        );
        const plusCode = plusCodeButton && plusCodeButton.getAttribute('aria-label')
          ? plusCodeButton.getAttribute('aria-label').replace('Plus code: ', '')
          : undefined;

        // About
        const aboutSection = document.querySelector('[aria-label*=\"About\"]');
        const about = aboutSection && aboutSection.textContent ? aboutSection.textContent.trim() : undefined;

        return {
          name,
          address,
          rating,
          reviewsCount,
          phone,
          website,
          businessStatus,
          businessTypes: businessTypesText ? [businessTypesText] : undefined,
          plusCode,
          about
        };
      })()`)

      // Extract coordinates from URL
      const coordinates = this.extractCoordinates(this.page.url())

      // Extract social media links
      const socialMedia = await this.extractSocialMedia()

      // Extract opening hours
      const openingHours = await this.extractOpeningHours()

      return {
        placeId,
        ...data,
        ...coordinates,
        ...socialMedia,
        openingHours,
      } as ScrapedPlaceData
    } catch (error) {
      console.error('Error scraping place details:', error)
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

  private extractCoordinates(url: string): {
    latitude?: number
    longitude?: number
  } {
    try {
      const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (match) {
        return {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2]),
        }
      }
    } catch (error) {
      console.error('Error extracting coordinates:', error)
    }
    return {}
  }

  private async extractSocialMedia(): Promise<{
    facebook?: string
    instagram?: string
    twitter?: string
    linkedin?: string
    email?: string
  }> {
    if (!this.page) return {}

    try {
      return await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'))
        const result: any = {}

        links.forEach((link) => {
          const href = link.getAttribute('href') || ''

          if (href.includes('facebook.com')) {
            result.facebook = href
          } else if (href.includes('instagram.com')) {
            result.instagram = href
          } else if (href.includes('twitter.com') || href.includes('x.com')) {
            result.twitter = href
          } else if (href.includes('linkedin.com')) {
            result.linkedin = href
          } else if (href.startsWith('mailto:')) {
            result.email = href.replace('mailto:', '')
          }
        })

        return result
      })
    } catch (error) {
      return {}
    }
  }

  private async extractOpeningHours(): Promise<any> {
    if (!this.page) return null

    try {
      // Click on hours button if available
      const hoursButton = await this.page.$('button[aria-label*="hours"]')

      if (hoursButton) {
        await hoursButton.click()
        await humanDelay(500, 1000)

        const hours = await this.page.evaluate(() => {
          const table = document.querySelector('table[aria-label*="hours"]')
          if (!table) return null

          const rows = Array.from(table.querySelectorAll('tr'))
          const schedule: any = {}

          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td'))
            if (cells.length >= 2) {
              const day = cells[0].textContent?.trim()
              const hours = cells[1].textContent?.trim()
              if (day && hours) {
                schedule[day] = hours
              }
            }
          })

          return schedule
        })

        return hours
      }
    } catch (error) {
      console.error('Error extracting opening hours:', error)
    }

    return null
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}
