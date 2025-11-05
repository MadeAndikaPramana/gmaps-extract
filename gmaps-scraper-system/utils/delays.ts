export async function humanDelay(min: number = 3000, max: number = 5000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, delay))
}

export async function cooldownDelay(duration: number = 60000): Promise<void> {
  console.log(`Cooldown: waiting ${duration}ms...`)
  return new Promise(resolve => setTimeout(resolve, duration))
}

// Helper for specific delays
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
