export function isNil(val: unknown): val is null | undefined {
  return val === null || val === undefined
}

/**
 * Creates a new URL by combining the specified URLs
 */
export function combineURLs(baseURL: string, relativeURL: string): string {
  return relativeURL ? `${baseURL.replace(/\/+$/, '')}/${relativeURL.replace(/^\/+/, '')}` : baseURL
}
