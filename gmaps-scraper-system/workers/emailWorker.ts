import 'dotenv/config';
import { emailScrapeQueue, EmailScrapeJobData } from '@/services/queue';
import { EmailScraper } from '@/services/emailScraper';
import { prisma } from '@/lib/prisma';
import { Job as BullJob } from 'bull';

emailScrapeQueue.process(5, async (job: BullJob<EmailScrapeJobData>) => {
  const { placeId, website } = job.data;
  const workerId = `EmailWorker-${Math.random().toString(36).substr(2, 4)}`;

  console.log(`[${workerId}] 📧 Starting email scrape for ${website} (Place ID: ${placeId})`);

  const scraper = new EmailScraper();

  try {
    await scraper.initialize();
    await prisma.scrapedPlace.update({
      where: { placeId },
      data: { emailScrapingStatus: 'SCRAPING' },
    });

    const emails = await scraper.scrapeEmails(website);

    console.log(`[${workerId}] ✅ Found ${emails.length} emails from ${website}`);

    await prisma.scrapedPlace.update({
      where: { placeId },
      data: {
        email: emails.join(', '),
        emailScrapingStatus: 'DONE',
      },
    });

  } catch (error: any) {
    console.error(`[${workerId}] ❌ Failed to scrape emails from ${website}:`, error);
    await prisma.scrapedPlace.update({
      where: { placeId },
      data: { emailScrapingStatus: 'FAILED' },
    });
    throw error;
  } finally {
    await scraper.close();
  }
});

emailScrapeQueue.on('completed', (job) => {
  console.log(`✅ Email scrape job ${job.id} completed`);
});

emailScrapeQueue.on('failed', (job, err) => {
  console.error(`❌ Email scrape job ${job?.id} failed:`, err);
});

emailScrapeQueue.on('stalled', (job) => {
  console.warn(`⚠️  Email scrape job ${job.id} stalled`);
});

console.log('📧 Email scrape worker started with 5 concurrent workers - listening for jobs...');
