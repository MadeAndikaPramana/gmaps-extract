type DiscordEmbedColor = 'success' | 'error' | 'warning' | 'info'

interface DiscordEmbed {
  title: string
  description?: string
  color: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  timestamp?: string
}

const COLORS: Record<DiscordEmbedColor, number> = {
  success: 0x00ff00, // Green
  error: 0xff0000,   // Red
  warning: 0xffa500, // Orange
  info: 0x0099ff,    // Blue
}

async function sendWebhook(embeds: DiscordEmbed[]): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('Discord webhook URL not configured')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds }),
    })

    if (!response.ok) {
      console.error('Failed to send Discord webhook:', response.statusText)
    }
  } catch (error) {
    console.error('Error sending Discord webhook:', error)
  }
}

export async function notifyJobStarted(job: {
  id: string
  clientName: string
  keywords: string[]
  maxResultsPerKeyword: number
  estimatedDuration?: number
}): Promise<void> {
  const totalKeywords = job.keywords.length
  const estimatedTotal = totalKeywords * job.maxResultsPerKeyword
  const estimatedHours = job.estimatedDuration
    ? Math.round(job.estimatedDuration / 3600)
    : 'Unknown'

  await sendWebhook([
    {
      title: '🚀 Job Started',
      description: `Starting scraping job for **${job.clientName}**`,
      color: COLORS.info,
      fields: [
        {
          name: 'Job ID',
          value: job.id,
          inline: true,
        },
        {
          name: 'Keywords',
          value: totalKeywords.toString(),
          inline: true,
        },
        {
          name: 'Estimated Total',
          value: `~${estimatedTotal} places`,
          inline: true,
        },
        {
          name: 'Estimated Duration',
          value: `~${estimatedHours} hours`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function notifyJobCompleted(job: {
  id: string
  clientName: string
  scrapedCount: number
  failedCount: number
  duration: number
}): Promise<void> {
  const durationHours = (job.duration / 3600).toFixed(2)
  const successRate = (
    (job.scrapedCount / (job.scrapedCount + job.failedCount)) *
    100
  ).toFixed(1)

  await sendWebhook([
    {
      title: '✅ Job Completed',
      description: `Successfully completed scraping job for **${job.clientName}**`,
      color: COLORS.success,
      fields: [
        {
          name: 'Job ID',
          value: job.id,
          inline: true,
        },
        {
          name: 'Places Scraped',
          value: job.scrapedCount.toString(),
          inline: true,
        },
        {
          name: 'Failed',
          value: job.failedCount.toString(),
          inline: true,
        },
        {
          name: 'Duration',
          value: `${durationHours} hours`,
          inline: true,
        },
        {
          name: 'Success Rate',
          value: `${successRate}%`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function notifyJobPaused(job: {
  id: string
  clientName: string
  reason: string
  scrapedCount: number
}): Promise<void> {
  await sendWebhook([
    {
      title: '⏸️ Job Paused',
      description: `Job paused for **${job.clientName}**`,
      color: COLORS.warning,
      fields: [
        {
          name: 'Job ID',
          value: job.id,
          inline: true,
        },
        {
          name: 'Reason',
          value: job.reason,
          inline: true,
        },
        {
          name: 'Progress',
          value: `${job.scrapedCount} places scraped`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function notifyJobFailed(job: {
  id: string
  clientName: string
  error: string
  scrapedCount: number
}): Promise<void> {
  await sendWebhook([
    {
      title: '❌ Job Failed',
      description: `Job failed for **${job.clientName}**`,
      color: COLORS.error,
      fields: [
        {
          name: 'Job ID',
          value: job.id,
          inline: true,
        },
        {
          name: 'Error',
          value: job.error.substring(0, 1000),
          inline: false,
        },
        {
          name: 'Progress Before Failure',
          value: `${job.scrapedCount} places scraped`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function notifyCaptchaDetected(job: {
  id: string
  clientName: string
  scrapedCount: number
}): Promise<void> {
  await sendWebhook([
    {
      title: '🚨 CAPTCHA DETECTED - URGENT',
      description: `CAPTCHA detected for job **${job.clientName}**. Job has been paused.`,
      color: COLORS.error,
      fields: [
        {
          name: 'Job ID',
          value: job.id,
          inline: true,
        },
        {
          name: 'Progress',
          value: `${job.scrapedCount} places scraped`,
          inline: true,
        },
        {
          name: 'Action Required',
          value: 'Please manually resolve the CAPTCHA or wait before resuming.',
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ])
}

export async function notifyMilestone(job: {
  id: string
  clientName: string
  scrapedCount: number
  totalEstimated: number
}): Promise<void> {
  const progress = ((job.scrapedCount / job.totalEstimated) * 100).toFixed(1)

  await sendWebhook([
    {
      title: '📊 Milestone Reached',
      description: `Job progress update for **${job.clientName}**`,
      color: COLORS.info,
      fields: [
        {
          name: 'Job ID',
          value: job.id,
          inline: true,
        },
        {
          name: 'Places Scraped',
          value: job.scrapedCount.toString(),
          inline: true,
        },
        {
          name: 'Progress',
          value: `${progress}%`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    },
  ])
}
