import type { AliyunOSSProvider, OSSFile, OssOptions, OSSUploader } from '../types'
import crypto from 'node:crypto'

export class AliyunOSSUploader implements OSSUploader {
  constructor(private readonly provider: AliyunOSSProvider) { }

  async uploadFile(_file: OSSFile, _options: OssOptions): Promise<void> {
    // TODO
  }

  private generateSignature(path: string, mimeType: string): string {
    const date = new Date().toUTCString()
    const signString = `PUT\n\n${mimeType}\n${date}\n/${this.provider.bucket}/${path}`
    const signature = crypto.createHmac('sha1', this.provider.accessKeySecret).update(signString).digest('base64')
    return `OSS ${this.provider.accessKeyId}:${signature}`
  }
}
