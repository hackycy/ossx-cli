export type Platform = 'Ali-OSS' | 'Tencent-OSS' | 'Custom'

export interface OssOptions {
  /**
   * OSS platform
   */
  platform: Platform

  /**
   * OSS Upload target directory
   */
  target: string

  /**
   * Oss configuration
   */
  config: Record<string, any> | (() => Promise<Record<string, any>> | Record<string, any>)
}
