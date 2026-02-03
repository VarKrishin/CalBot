const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_INITIAL_MS = 500

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; initialMs?: number } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const initialMs = options.initialMs ?? DEFAULT_INITIAL_MS
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === maxAttempts) throw e
      const delay = initialMs * Math.pow(2, attempt - 1)
      await sleep(delay)
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
