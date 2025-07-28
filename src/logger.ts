import type { OssOptions } from './types'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { isAxiosError } from 'axios'
import { safeStringify } from './utils'

export class Logger {
  private logFilePath: string
  private provider: Record<string, any>
  private startTime: Date
  private logDir: string
  private maxLogfiles?: number

  constructor(logDir: string, cfg: OssOptions) {
    this.startTime = new Date()
    this.logDir = logDir
    this.maxLogfiles = cfg.maxLogfiles
    this.provider = cfg.provider

    const logFileName = `ossx-${this.getLocalTimestamp(true)}.log`
    this.logFilePath = path.join(logDir, logFileName)

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Create log file with initial header
    let header = `OSS Upload Log - Started at ${this.getLocalTimestamp()}\n`

    if (cfg.target) {
      header += `  Target Directory: ${cfg.target}\n`
    }
    if (cfg.destination) {
      header += `  Destination Directory: ${cfg.destination}\n`
    }
    if (cfg.cwd) {
      header += `  CWD: ${cfg.cwd}\n`
    }

    header += `  Provider: ${this.provider.name || 'N/A'}\n`

    Object.entries(this.provider).forEach(([key, value]) => {
      if (key === 'name') {
        return
      }
      header += `    ${key}: ${value || 'N/A'}\n`
    })

    fs.writeFileSync(this.logFilePath, header.trim())
    this.logSeparator()

    // Clean up old log files if maxLogfiles is specified
    if (typeof this.maxLogfiles === 'number' && this.maxLogfiles > 0) {
      this.cleanupOldLogFiles()
    }
  }

  logError(file: string, error: unknown): void {
    const timestamp = this.getLocalTimestamp()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stackTrace = error instanceof Error ? error.stack : ''

    let logEntry = `[${timestamp}] ERROR: Failed to upload ${file}\n`
      + `Message: ${errorMessage}\n`
      + `Stack: ${stackTrace}\n`

    if (isAxiosError(error)) {
      // HTTP request/response format logging
      logEntry += `\nHTTP Request:\n`
      logEntry += `  Method: ${error.config?.method?.toUpperCase() || 'UNKNOWN'}\n`
      logEntry += `  URL: ${error.config?.url || 'N/A'}\n`

      // Add URL params if present
      if (error.config?.params) {
        logEntry += `  URL Params: ${safeStringify(error.config.params)}\n`
      }

      // Add request data type information
      if (error.config?.data !== undefined) {
        const dataType = typeof error.config.data
        const isFormData = error.config.data instanceof FormData
        const isBuffer = Buffer.isBuffer(error.config.data)

        let dataInfo: string = dataType
        if (isFormData) {
          dataInfo = 'FormData'
        }
        else if (isBuffer) {
          dataInfo = 'Buffer'
        }
        else if (dataType === 'object' && error.config.data !== null) {
          dataInfo = `${dataType} (${Array.isArray(error.config.data) ? 'Array' : 'Object'})`
        }

        logEntry += `  Request Data: [${dataInfo}]\n`
      }

      logEntry += `  Status: ${error.response?.status || 'N/A'} ${error.response?.statusText || ''}\n`

      if (error.config?.headers) {
        logEntry += `  Request Headers:\n`
        Object.entries(error.config.headers).forEach(([key, value]) => {
          logEntry += `    ${key}: ${value}\n`
        })
      }

      if (error.response?.headers) {
        logEntry += `  Response Headers:\n`
        Object.entries(error.response.headers).forEach(([key, value]) => {
          logEntry += `    ${key}: ${value}\n`
        })
      }

      if (error.response?.data) {
        const formatData = typeof error.response.data === 'string'
          ? error.response.data
          : safeStringify(error.response.data)
        logEntry += `  Response Body:\n${formatData}`
      }
    }

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

  /**
   * Clean up old log files when maxLogfiles limit is exceeded
   */
  private cleanupOldLogFiles(): void {
    try {
      const files = fs.readdirSync(this.logDir)
      const logFiles = files
        .filter((file) => {
          return file.startsWith('ossx-') && file.endsWith('.log') && fs.statSync(path.join(this.logDir, file)).isFile()
        })
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stats: fs.statSync(path.join(this.logDir, file)),
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()) // Sort by modification time, newest first

      // If we have more log files than the limit, remove the oldest ones
      if (logFiles.length > this.maxLogfiles!) {
        const filesToRemove = logFiles.slice(this.maxLogfiles!)
        filesToRemove.forEach((file) => {
          try {
            fs.rmSync(file.path)
          }
          catch {
            // Silently ignore errors when removing old log files
          }
        })
      }
    }
    catch {
      // Silently ignore errors during cleanup
    }
  }

  public getLogPath(): string {
    return this.logFilePath
  }
}
