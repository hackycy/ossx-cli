import type { OSSFile } from './types'
import path from 'node:path'
import process from 'node:process'
import ansis from 'ansis'
import CliProgress from 'cli-progress'
import { loadOssConfig } from './config'
import { Logger } from './logger'
import { uploadOSS } from './upload'
import { clearScreen, isFunction } from './utils'

export enum ExitCode {
  Success = 0,
  FatalError = 1,
}

export async function bootstrap(): Promise<void> {
  try {
    process.on('uncaughtException', errorHandler)
    process.on('unhandledRejection', errorHandler)

    const cfg = await loadOssConfig()

    const cwd = cfg.cwd || process.cwd()

    // Initialize logger
    const logDir = path.resolve(cwd, cfg.logDir || '.')
    const logger: Logger | undefined = cfg.logger ? new Logger(logDir, cfg.provider) : undefined

    const bar = new CliProgress.SingleBar({
      format: `${ansis.cyanBright('⚡')} ${ansis.bold('Uploading')} ${ansis.yellowBright(`{total} files`)} ${ansis.dim('|')} ${ansis.magentaBright('{bar}')} ${ansis.dim('|')} ${ansis.yellowBright('{percentage}%')} ${ansis.dim('|')} ${ansis.dim(`#{value}`)} ${ansis.greenBright('{filename}')}`,
      hideCursor: true,
      clearOnComplete: true,
      barsize: 40,
    }, CliProgress.Presets.shades_classic)

    await uploadOSS({
      ...cfg,
      cwd,
      onStart: async (total: number): Promise<void> => {
        clearScreen()
        console.log(`${ansis.bold.cyanBright('OSSX CLI')}`)
        console.log()
        bar.start(total, 0, { filename: '' })

        if (isFunction(cfg.onStart)) {
          await cfg.onStart(total)
        }
      },
      onProgress: async (file: OSSFile, current: number, total: number, error?: unknown): Promise<void> => {
        bar.update(current, { filename: file.filename })

        if (error) {
          // Log the error with detailed information
          logger?.logError(file.remoteFilePath, error)

          if (cfg.abortOnFailure) {
            errorHandler(new Error(`Upload failed for ${file.remoteFilePath}, aborting...`))
          }
        }

        if (isFunction(cfg.onProgress)) {
          await cfg.onProgress(file, current, total, error)
        }
      },
      onFinish: async (total: number, fail: number): Promise<void> => {
        bar.stop()

        // Log task completion summary
        logger?.logTaskCompletion(total, total - fail, fail)

        console.log(`${ansis.bold.yellowBright(`${fail <= 0 ? '🎉' : '⚠️'}  Upload completed`)}${ansis.dim(':')} ${ansis.cyanBright('•')} ${ansis.bold('Total:')} ${ansis.cyan(total)} ${ansis.greenBright('•')} ${ansis.bold('Success:')} ${ansis.green(total - fail)}${fail > 0 ? ` ${ansis.redBright('•')} ${ansis.bold('Failed:')} ${ansis.red(fail)}` : ''}`)

        if (isFunction(cfg.onFinish)) {
          await cfg.onFinish(total, fail)
        }
      },
    })
  }
  catch (error) {
    errorHandler(error as Error)
  }
}

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message += `\n\n${error.stack || ''}`

  console.log()
  console.log()
  console.error(message)
  process.exit(ExitCode.FatalError)
}
