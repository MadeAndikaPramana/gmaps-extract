import { Browser, Page } from 'puppeteer'

/**
 * Apply additional stealth measures to a page
 */
export async function applyStealthMeasures(page: Page): Promise<void> {
  // Set realistic viewport
  await page.setViewport({
    width: 1920 + Math.floor(Math.random() * 100),
    height: 1080 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  })

  // Set user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  )

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  })

  // Override permissions
  const context = page.browserContext()
  await context.overridePermissions('https://www.google.com', [
    'geolocation',
    'notifications',
  ])
}

/**
 * Check if CAPTCHA is present on the page
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  try {
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      '.g-recaptcha',
      '#captcha',
      '[aria-label*="captcha"]',
      'iframe[title*="recaptcha"]',
    ]

    for (const selector of captchaSelectors) {
      const element = await page.$(selector)
      if (element) {
        return true
      }
    }

    // Check for common CAPTCHA text
    const bodyText = await page.evaluate(() => document.body.innerText)
    const captchaKeywords = ['unusual traffic', 'verify you are not a robot', 'captcha']

    return captchaKeywords.some(keyword =>
      bodyText.toLowerCase().includes(keyword)
    )
  } catch (error) {
    console.error('Error detecting CAPTCHA:', error)
    return false
  }
}

/**
 * Random mouse movements for more human-like behavior
 */
export async function randomMouseMovement(page: Page): Promise<void> {
  try {
    const viewport = page.viewport()
    if (!viewport) return

    const x = Math.floor(Math.random() * viewport.width)
    const y = Math.floor(Math.random() * viewport.height)

    await page.mouse.move(x, y, {
      steps: Math.floor(Math.random() * 10) + 5,
    })
  } catch (error) {
    // Ignore errors in mouse movement
  }
}

/**
 * Scroll page randomly
 */
export async function randomScroll(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const scrollHeight = document.body.scrollHeight
      const scrollTo = Math.floor(Math.random() * scrollHeight * 0.3)
      window.scrollTo({
        top: scrollTo,
        behavior: 'smooth',
      })
    })
  } catch (error) {
    // Ignore errors in scrolling
  }
}
