import type { OssOptions } from './types'
import path from 'node:path'
import process from 'node:process'
import { loadConfig } from 'c12'

const defaultOssOptions: Partial<OssOptions> = {
  target: 'dist',
  removeWhenUploaded: false,
  abortOnFailure: false,
  logger: true,
  logDir: path.join('node_modules', '.ossx'),
  cwd: process.cwd(),
}

export async function loadOssConfig(overrides?: Partial<OssOptions>, cwd = process.cwd()): Promise<OssOptions> {
  const name = 'ossx'

  const { config } = await loadConfig<OssOptions>({
    name,
    cwd,
    defaults: defaultOssOptions as OssOptions,
    overrides: {
      ...overrides as OssOptions,
    },
  })

  return config
}

export function defineConfig(config: OssOptions): OssOptions {
  return config
}
