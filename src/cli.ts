import process from 'node:process'
import { loadOssConfig } from './config'
import { uploadOSS } from './upload'

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
    await uploadOSS(cfg)
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
