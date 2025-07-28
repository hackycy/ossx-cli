import process from 'node:process'
import readline from 'node:readline'

export function isNil(val: unknown): val is null | undefined {
  return val === null || val === undefined
}

// eslint-disable-next-line ts/no-unsafe-function-type
export function isFunction(val: unknown): val is Function {
  return typeof val === 'function'
}

/**
 * Creates a new URL by combining the specified URLs
 */
export function combineURLs(baseURL: string, relativeURL: string): string {
  return relativeURL ? `${baseURL.replace(/\/+$/, '')}/${relativeURL.replace(/^\/+/, '')}` : baseURL
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function clearScreen(): void {
  const repeatCount = process.stdout.rows - 2
  const blank = repeatCount > 0 ? '\n'.repeat(repeatCount) : ''
  console.log(blank)
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)
}

export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  }
  catch {
    return `${obj}`
  }
}
