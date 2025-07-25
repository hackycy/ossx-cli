import process from 'node:process'
import cac from 'cac'
import { version } from '../package.json'

export function loadCliArgs(argv = process.argv): Record<string, any> {
  const cli = cac('ossx')

  cli
    .version(version)
    .option('--clean', 'Clean all log files', { default: false })
    .help()

  const result = cli.parse(argv)

  const args = result.options

  return args
}
