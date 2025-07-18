import type { OssOptions } from './types'
import process from 'node:process'
import { loadConfig } from 'c12'

const defaultOssOptions: Partial<OssOptions> = {
  platform: 'Ali-OSS',
  target: 'dist',
}

export async function loadOssConfig(overrides?: Partial<OssOptions>, cwd = process.cwd()): Promise<OssOptions> {
  const name = 'oss'

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
