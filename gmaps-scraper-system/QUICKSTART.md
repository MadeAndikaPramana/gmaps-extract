# Quick Start Guide

Get your Google Maps Scraper System up and running in minutes.

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ PostgreSQL 13+ running
- ✅ Redis 6+ running

## 5-Minute Setup

### Step 1: Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Step 2: Configure Environment

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` and set your database URL:

\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/gmaps_scraper"
REDIS_URL="redis://localhost:6379"
DISCORD_WEBHOOK_URL=""  # Optional, leave empty for now
\`\`\`

### Step 3: Setup Database

Create your PostgreSQL database:

\`\`\`bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE gmaps_scraper;
\q
\`\`\`

Run migrations:

\`\`\`bash
npx prisma migrate dev --name init
npx prisma generate
\`\`\`

### Step 4: Start the System

**Terminal 1** - Start the web application:

\`\`\`bash
npm run dev
\`\`\`

**Terminal 2** - Start the worker:

\`\`\`bash
npm run worker
\`\`\`

### Step 5: Create Your First Job

1. Open http://localhost:3000
2. Click "New Job"
3. Enter:
   - Client Name: "Test Client"
   - Keyword: "coffee shops"
   - Location: "San Francisco, CA" (optional)
4. Click "Create Job"
5. Watch it scrape in real-time! ✨

## Common Issues

### "Cannot connect to database"
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in .env is correct
- Ensure database exists

### "Cannot connect to Redis"
- Check Redis is running: `redis-cli ping`
- Should return "PONG"
- Start Redis: `brew services start redis` (macOS) or `sudo systemctl start redis` (Linux)

### "Worker not processing jobs"
- Ensure worker terminal is running `npm run worker`
- Check Redis connection
- Look for errors in worker terminal

### "CAPTCHA detected immediately"
- This is normal on first run if using VPN
- Wait 1 hour and try again
- Use safe delay settings (3-5 seconds)

## Discord Notifications (Optional)

To get job notifications in Discord:

1. Go to your Discord server
2. Server Settings → Integrations → Webhooks
3. Create New Webhook
4. Copy Webhook URL
5. Add to .env: `DISCORD_WEBHOOK_URL="your_webhook_url"`
6. Restart the application

## What's Next?

- Read the full [README.md](README.md) for detailed documentation
- Experiment with different keywords and locations
- Export your data as CSV
- Set up Discord notifications
- Monitor jobs in real-time from the dashboard

## Production Deployment

For production use with PM2:

\`\`\`bash
npm install -g pm2
pm2 start npm --name "gmaps-app" -- start
pm2 start npm --name "gmaps-worker" -- run worker
pm2 save
pm2 startup
\`\`\`

## Need Help?

Check the troubleshooting section in [README.md](README.md) or contact support.
