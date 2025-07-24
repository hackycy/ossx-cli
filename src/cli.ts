import type { OSSFile } from './types'
import process from 'node:process'
import ansis from 'ansis'
import CliProgress from 'cli-progress'
import { loadOssConfig } from './config'
import { uploadOSS } from './upload'
import { clearScreen, isFunction } from './utils'

export enum ExitCode {
  Success = 0,
  FatalError = 1,
  InvalidArgument = 9,
}

export async function bootstrap(): Promise<void> {
  try {
    process.on('uncaughtException', errorHandler)
    process.on('unhandledRejection', errorHandler)

    const cfg = await loadOssConfig()

    const bar = new CliProgress.SingleBar({
      format: `${ansis.cyanBright('⚡')} ${ansis.bold('Uploading')} ${ansis.yellowBright(`{total} files`)} ${ansis.dim('|')} ${ansis.magentaBright('{bar}')} ${ansis.dim('|')} ${ansis.yellowBright('{percentage}%')} ${ansis.dim('|')} ${ansis.dim(`#{value}`)} ${ansis.greenBright('{filename}')}`,
      hideCursor: true,
      clearOnComplete: false,
      barsize: 40,
    }, CliProgress.Presets.shades_classic)

    await uploadOSS({
      ...cfg,
      onStart: async (total: number): Promise<void> => {
        clearScreen()
        console.log(`${ansis.bold.cyanBright('OSSX CLI')}`)
        console.log()
        bar.start(total, 0, { filename: '' })

        if (isFunction(cfg.onStart)) {
          cfg.onStart(total)
        }
      },
      onProgress: async (file: OSSFile, current: number, total: number): Promise<void> => {
        bar.update(current, { filename: file.filename })

        if (isFunction(cfg.onProgress)) {
          cfg.onProgress(file, current, total)
        }
      },
      onComplete: async (file: OSSFile, error: unknown): Promise<void> => {
        if (isFunction(cfg.onComplete)) {
          cfg.onComplete(file, error)
        }
      },
      onFinish: async (total: number, fail: number): Promise<void> => {
        bar.stop()
        console.log()
        console.log(`✨ Upload completed: ${ansis.cyan(total)} files processed, ${ansis.yellow(fail)} failed.`)

        if (isFunction(cfg.onFinish)) {
          cfg.onFinish(total, fail)
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

  console.error(message)
  process.exit(ExitCode.FatalError)
}
