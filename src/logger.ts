import fs from 'node:fs'
import path from 'node:path'

export class Logger {
  private logFilePath: string
  private provider: Record<string, any>

  constructor(logDir: string, provider: Record<string, any>) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFileName = `ossx-${timestamp}.log`
    this.logFilePath = path.join(logDir, logFileName)
    this.provider = provider

    // Ensure log directory exists
    fs.mkdirSync(logDir, { recursive: true })

    // Create log file with initial header
    let header = `OSS Upload Log - Started at ${timestamp}\n`
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
    const timestamp = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stackTrace = error instanceof Error ? error.stack : ''

    const logEntry = `[${timestamp}] ERROR: Failed to upload ${file}\n`
      + `  Message: ${errorMessage}\n`
      + `  Stack: ${stackTrace}`

    fs.appendFileSync(this.logFilePath, logEntry)
    this.logSeparator()
  }

  logTaskCompletion(totalFiles: number, successCount: number, failCount: number): void {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] TASK COMPLETED\n`
      + `  Total files processed: ${totalFiles}\n`
      + `  Successfully uploaded: ${successCount}\n`
      + `  Failed uploads: ${failCount}\n`
      + `  Success rate: ${totalFiles > 0 ? ((successCount / totalFiles) * 100).toFixed(2) : 0}%`

    fs.appendFileSync(this.logFilePath, logEntry)
    this.logSeparator()
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
