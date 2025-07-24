import type { AliyunOSSProvider, IUploadContext, OSSUploader } from '../types'
import crypto from 'node:crypto'
import fs from 'node:fs'

export class AliyunOSSUploader implements OSSUploader {
  constructor(private readonly provider: AliyunOSSProvider) { }

  async uploadFile(ctx: IUploadContext): Promise<void> {
    const { request, file } = ctx
    if (!file.mimeType) {
      throw new Error(`No mime type found for file ${file.filename}`)
    }

    const signature = this.generateSignature(file.remoteFilePath, file.mimeType)
    const buffer = fs.readFileSync(file.localFilePath)

    const result = await request.request({
      method: 'PUT',
      url: `https://${this.provider.bucket}.${this.provider.area}.aliyuncs.com/${encodeURI(file.remoteFilePath)}`,
      headers: {
        'Host': `${this.provider.bucket}.${this.provider.area}.aliyuncs.com`,
        'Authorization': signature,
        'Date': new Date().toUTCString(),
        'Content-Type': file.mimeType,
      },
      data: buffer,
    })

    if (result.status !== 200) {
      throw new Error('Upload failed')
    }
  }

  private generateSignature(path: string, mimeType: string): string {
    const date = new Date().toUTCString()
    const signString = `PUT\n\n${mimeType}\n${date}\n/${this.provider.bucket}/${path}`
    const signature = crypto.createHmac('sha1', this.provider.accessKeySecret).update(signString).digest('base64')
    return `OSS ${this.provider.accessKeyId}:${signature}`
  }
}
