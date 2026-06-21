import process from 'node:process'
import { cac } from 'cac'
import { version } from '../package.json'

const cli = cac('ossx')

// global options
interface GlobalCLIOptions {
  '--'?: string[]
  'config'?: string
}

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message += `\n\n${error.stack || ''}`

  console.log()
  console.error(message)
  process.exit(1)
}

process.on('uncaughtException', errorHandler)
process.on('unhandledRejection', errorHandler)

cli
  .command('', 'run')
  .option('-c, --config <file>', `[string] use specified config file`)
  .action(async (options: GlobalCLIOptions) => {
    const { upload } = await import('./upload')
    const result = await upload(options.config)
    if (result && !result.succeeded) {
      process.exitCode = 1
    }
  })

cli.help()
cli.version(version)

cli.parse()
