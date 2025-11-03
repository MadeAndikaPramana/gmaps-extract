# Google Maps Scraper System

A self-hosted automated Google Maps scraping system with job queue management and real-time admin dashboard.

## Features

- **Automated Scraping**: Background job processing with Puppeteer for Google Maps data extraction
- **Job Queue**: Bull queue system with Redis for reliable job management
- **Real-time Dashboard**: Next.js dashboard with Server-Sent Events for live progress updates
- **Data Export**: CSV export functionality for all scraped data
- **Discord Notifications**: Webhook integration for job status updates
- **Anti-Detection**: Stealth plugin with human-like delays and session rotation
- **Resume Capability**: Pause and resume jobs with progress tracking
- **Database**: PostgreSQL with Prisma ORM for data persistence

## Tech Stack

- **Frontend**: Next.js 14 (App Router), shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Bull with Redis
- **Scraper**: Puppeteer + puppeteer-extra-plugin-stealth
- **Real-time**: Server-Sent Events (SSE)
- **Notifications**: Discord Webhooks

## Data Extracted

For each place on Google Maps, the system extracts:

- Name, Address, City
- Rating, Reviews Count
- Phone Number, Website
- Email (if available)
- Social Media (Facebook, Instagram, Twitter, LinkedIn)
- Plus Code, Coordinates (Latitude/Longitude)
- Business Status, Business Types
- Opening Hours
- About/Description

## Prerequisites

- Node.js 18+ (tested on Mac M4 ARM)
- PostgreSQL 13+
- Redis 6+
- Chrome/Chromium (installed automatically by Puppeteer)

## Installation

### 1. Clone and Install Dependencies

\`\`\`bash
cd gmaps-scraper-system
npm install
\`\`\`

### 2. Setup PostgreSQL Database

Create a new PostgreSQL database:

\`\`\`sql
CREATE DATABASE gmaps_scraper;
CREATE USER scraper_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE gmaps_scraper TO scraper_user;
\`\`\`

### 3. Setup Redis

Install Redis if not already installed:

\`\`\`bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
\`\`\`

### 4. Configure Environment Variables

Copy the example environment file:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your configuration:

\`\`\`env
DATABASE_URL="postgresql://scraper_user:your_secure_password@localhost:5432/gmaps_scraper"
REDIS_URL="redis://localhost:6379"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
NODE_ENV="development"
\`\`\`

### 5. Setup Discord Webhook (Optional but Recommended)

1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook
4. Copy the webhook URL and add it to your `.env` file

### 6. Initialize Database

Run Prisma migrations to create database tables:

\`\`\`bash
npx prisma migrate dev --name init
npx prisma generate
\`\`\`

### 7. Download Chromium for Puppeteer

\`\`\`bash
# This downloads Chromium for your platform
node node_modules/puppeteer/install.js
\`\`\`

## Running the Application

The system requires two processes to run:

### Terminal 1: Next.js Application (Dashboard + API)

\`\`\`bash
npm run dev
\`\`\`

This starts the dashboard at `http://localhost:3000`

### Terminal 2: Worker Process (Job Processor)

\`\`\`bash
npm run worker
\`\`\`

This starts the Bull worker that processes scraping jobs.

**IMPORTANT**: Both processes must be running for the system to work properly.

## Usage

### Creating a New Job

1. Navigate to `http://localhost:3000`
2. Click "New Job"
3. Fill in the form:
   - **Client Name**: Name of the client requesting the data
   - **Keywords**: Search terms (e.g., "restaurants", "coffee shops")
   - **Locations** (optional): Specific locations (e.g., "New York, NY")
   - **Max Results Per Keyword**: Maximum places to scrape per keyword (default: 500)
   - **Advanced Settings**: Adjust delays and cooldown periods
4. Click "Create Job"

### Monitoring Jobs

- **Dashboard**: View active jobs with real-time progress updates
- **Jobs List**: Browse all jobs with filtering options
- **Job Details**: Click on any job to see detailed information, logs, and scraped data

### Pausing/Resuming Jobs

- Jobs can be paused manually from the job detail page
- Jobs are automatically paused if CAPTCHA is detected
- Resume paused jobs from the job detail page

### Exporting Data

1. Go to the job detail page
2. Wait for the job to complete
3. Click "Download CSV" button
4. CSV file will be downloaded with all scraped data

CSV files are also saved in the `/exports` folder.

## System Configuration

### Safe Defaults

The system comes with safe defaults to avoid triggering Google's anti-bot measures:

- **Delays**: 3-5 seconds between requests (Gaussian distribution)
- **Cooldown**: 1 minute rest after every 50 items
- **Session Rotation**: New browser instance every 500 places or 1 hour
- **Single Worker**: Only one job processes at a time

### Customizing Delays

You can adjust delays when creating a job:

- **Min/Max Delay**: Time between scraping each place
- **Cooldown After**: Number of items before taking a break
- **Cooldown Duration**: Length of the break

**Warning**: Reducing delays increases CAPTCHA risk. Use safe defaults for best results.

## Architecture

\`\`\`
┌─────────────────┐
│   Next.js App   │  (Dashboard + API)
│   Port: 3000    │
└────────┬────────┘
         │
         ├─────────────┐
         │             │
    ┌────▼───┐   ┌────▼────┐
    │ Prisma │   │  Bull   │
    │   ORM  │   │  Queue  │
    └────┬───┘   └────┬────┘
         │            │
    ┌────▼─────┐ ┌───▼────┐
    │PostgreSQL│ │  Redis │
    └──────────┘ └────────┘
         │
         │
    ┌────▼──────┐
    │   Worker  │  (Scrape Processor)
    │ Puppeteer │
    └───────────┘
\`\`\`

## Project Structure

\`\`\`
gmaps-scraper-system/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   │   ├── jobs/           # Job management endpoints
│   │   ├── stats/          # Statistics endpoint
│   │   └── sse/            # Server-Sent Events
│   ├── dashboard/          # Dashboard pages
│   │   ├── page.tsx       # Main dashboard
│   │   ├── new/           # New job form
│   │   └── jobs/          # Jobs list and detail
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── prisma.ts          # Prisma client
│   ├── redis.ts           # Redis client
│   └── utils.ts           # Utility functions
├── services/
│   ├── scraper.ts         # Puppeteer scraping logic
│   ├── queue.ts           # Bull queue setup
│   ├── discord.ts         # Discord notifications
│   └── export.ts          # CSV export
├── workers/
│   └── scrapeWorker.ts    # Bull worker process
├── utils/
│   ├── delays.ts          # Delay utilities
│   └── stealth.ts         # Anti-detection measures
├── prisma/
│   └── schema.prisma      # Database schema
├── exports/               # Generated CSV files
├── .env.example          # Environment template
└── README.md             # This file
\`\`\`

## Database Schema

### Job
Tracks scraping jobs with status and progress.

### ScrapedPlace
Stores scraped place data with unique place_id constraint for deduplication.

### FailedScrape
Logs failed scraping attempts with error details and retry count.

### SystemLog
System-wide logging for monitoring and debugging.

## Troubleshooting

### CAPTCHA Detected

If a job is paused due to CAPTCHA:
1. Wait at least 1 hour before resuming
2. Consider increasing delays in job settings
3. Check Discord for notifications

### Worker Not Processing Jobs

Ensure the worker process is running:
\`\`\`bash
npm run worker
\`\`\`

Check Redis connection:
\`\`\`bash
redis-cli ping
\`\`\`

### Database Connection Errors

Verify PostgreSQL is running:
\`\`\`bash
psql -U scraper_user -d gmaps_scraper
\`\`\`

Check your DATABASE_URL in `.env`

### Puppeteer Chrome Download Failed

Manually install Chromium:
\`\`\`bash
node node_modules/puppeteer/install.js
\`\`\`

Or set PUPPETEER_SKIP_DOWNLOAD and install Chrome manually.

## Performance

### Typical Job Duration

With safe defaults (3-5s delays):
- 500 places: ~45-60 minutes
- 5000 places (10 keywords × 500): ~8-10 hours

### Scalability

- Single worker design prevents parallel scraping
- Database can handle millions of records
- Redis queue is highly performant

## Security Notes

- No authentication by default (self-hosted, trusted environment)
- Keep .env file secure and never commit it
- Use strong passwords for PostgreSQL
- Discord webhook URLs should be kept private

## Production Deployment

For production use:

1. Set `NODE_ENV=production` in `.env`
2. Use a production PostgreSQL server
3. Use Redis with persistence enabled
4. Set up process managers (PM2) for both processes:

\`\`\`bash
# Install PM2
npm install -g pm2

# Start Next.js app
pm2 start npm --name "gmaps-app" -- start

# Start worker
pm2 start npm --name "gmaps-worker" -- run worker

# Save PM2 configuration
pm2 save
pm2 startup
\`\`\`

## License

This project is private and proprietary. Not licensed for redistribution.

## Support

For issues or questions, contact the development team.

## Changelog

### Version 1.0.0
- Initial release
- Complete scraping system with dashboard
- Job queue with Bull and Redis
- CSV export functionality
- Discord notifications
- Real-time progress updates via SSE
