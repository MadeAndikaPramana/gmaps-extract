/**
 * Generate a random delay with Gaussian distribution for more human-like timing
 */
export function getRandomDelay(min: number, max: number): number {
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random()
  const u2 = Math.random()
  const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

  // Scale and shift to fit between min and max
  const mean = (min + max) / 2
  const stdDev = (max - min) / 6 // 99.7% of values will be within range

  let delay = mean + gaussian * stdDev

  // Clamp to min/max range
  delay = Math.max(min, Math.min(max, delay))

  return Math.round(delay)
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get a human-like delay between actions
 * Optimized to 2-4 seconds for speed with 3 concurrent workers
 */
export async function humanDelay(minMs = 2000, maxMs = 4000): Promise<void> {
  const delay = getRandomDelay(minMs, maxMs)
  await sleep(delay)
}

/**
 * Cooldown period after scraping multiple items
 * Optimized to 60 seconds for better throughput
 */
export async function cooldownDelay(durationMs = 60000): Promise<void> {
  console.log(`⏸️  Cooldown period: ${durationMs / 1000} seconds...`)
  await sleep(durationMs)
}
