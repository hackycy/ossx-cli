import fs from 'node:fs'
import path from 'node:path'

export class Logger {
  private logFilePath: string
  private provider: Record<string, any>
  private startTime: Date

  constructor(logDir: string, provider: Record<string, any>) {
    this.startTime = new Date()
    const logFileName = `ossx-${this.getLocalTimestamp(true)}.log`
    this.logFilePath = path.join(logDir, logFileName)
    this.provider = provider

    // Ensure log directory exists
    fs.mkdirSync(logDir, { recursive: true })

    // Create log file with initial header
    let header = `OSS Upload Log - Started at ${this.getLocalTimestamp()}\n`
      + `  Provider: ${this.provider.name || 'N/A'}\n`

    Object.entries(this.provider).forEach(([key, value]) => {
      if (key === 'name') {
        return
      }
      header += `  ${key}: ${value || 'N/A'}\n`
    })
    fs.writeFileSync(this.logFilePath, header.trim())
    this.logSeparator()
  }

  logError(file: string, error: unknown): void {
    const timestamp = this.getLocalTimestamp()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stackTrace = error instanceof Error ? error.stack : ''

    const logEntry = `[${timestamp}] ERROR: Failed to upload ${file}\n`
      + `  Message: ${errorMessage}\n`
      + `  Stack: ${stackTrace}`

    fs.appendFileSync(this.logFilePath, logEntry)
    this.logSeparator()
  }

  logTaskCompletion(totalFiles: number, successCount: number, failCount: number): void {
    const timestamp = this.getLocalTimestamp()
    const elapsedMs = Date.now() - this.startTime.getTime()
    const elapsedTime = this.formatElapsedTime(elapsedMs)

    const logEntry = `OSS Upload Log - Complete at ${timestamp}\n`
      + `  Total files processed: ${totalFiles}\n`
      + `  Successfully uploaded: ${successCount}\n`
      + `  Failed uploads: ${failCount}\n`
      + `  Success rate: ${totalFiles > 0 ? ((successCount / totalFiles) * 100).toFixed(2) : 0}%\n`
      + `  Elapsed time: ${elapsedTime}`

    fs.appendFileSync(this.logFilePath, logEntry)
    this.logSeparator()
  }

  /**
   * Formats elapsed time in milliseconds to human-readable format
   */
  private formatElapsedTime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    }
    else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    else if (seconds > 0) {
      return `${seconds}s ${ms % 1000}ms`
    }
    else {
      return `${ms}ms`
    }
  }

  /**
   * Generates a local timestamp string in format: YYYY-MM-DD-HH-mm-ss
   */
  private getLocalTimestamp(file = false): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

    if (file) {
      return `${year}${month}${day}${hours}${minutes}${seconds}`
    }
    else {
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
  }

  /**
   * Generates a separator line in the log file.
   * @param symbol - Character to use for the separator, default is '-'
   */
  private logSeparator(symbol = '-'): void {
    const separator = `\n${symbol.repeat(80)}\n`
    fs.appendFileSync(this.logFilePath, separator)
  }

  public getLogPath(): string {
    return this.logFilePath
  }
}
