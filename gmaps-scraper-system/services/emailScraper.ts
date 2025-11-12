import puppeteer, { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { applyStealthMeasures } from '@/utils/stealth';

const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

export class EmailScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
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
    });
    this.page = await this.browser.newPage();
    await applyStealthMeasures(this.page);
  }

  async scrapeEmails(url: string): Promise<string[]> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      let emails = new Set<string>();

      // Scrape homepage
      const homePageEmails = await this.extractEmailsFromPage();
      homePageEmails.forEach(email => emails.add(email));

      // Find and visit contact/about pages
      const contactLinks = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .map(link => link.href)
          .filter(href => href && (href.includes('contact') || href.includes('about')));
      });

      for (const link of [...new Set(contactLinks)].slice(0, 2)) { // Limit to 2 pages to avoid excessive scraping
        try {
          await this.page.goto(link, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
          const pageEmails = await this.extractEmailsFromPage();
          pageEmails.forEach(email => emails.add(email));
        } catch (error) {
          console.error(`Error navigating to ${link}:`, error);
        }
      }

      return Array.from(emails);
    } catch (error) {
      console.error(`Error scraping emails from ${url}:`, error);
      return [];
    }
  }

  private async extractEmailsFromPage(): Promise<string[]> {
    if (!this.page) {
      return [];
    }
    return this.page.evaluate(() => {
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
      const bodyText = document.body.innerText;
      const matches = bodyText.match(emailRegex) || [];
      return [...new Set(matches)];
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
