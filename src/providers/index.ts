import type { OSSUploader, Provider } from '../types'
import { AliyunOSSUploader } from './aliyun'
import { CustomUploader } from './custom'
import { TencentCOSUploader } from './tencent'

/**
 * Creates an uploader instance based on the provider type
 */
export function createUploader(provider: Provider): OSSUploader {
  switch (provider.name) {
    case 'aliyun-oss':
      return new AliyunOSSUploader(provider)
    case 'tencent-cloud-cos':
      return new TencentCOSUploader(provider)
    case 'custom':
      return new CustomUploader(provider)
    default:
      throw new Error(`Unsupported provider: ${(provider as any).name}`)
  }
}
