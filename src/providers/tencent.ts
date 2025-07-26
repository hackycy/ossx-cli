import type { IUploadContext, OSSUploader, TencentCloudCOS } from '../types'
import crypto from 'node:crypto'
import fs from 'node:fs'

interface ISignature {
  signature: string
  signTime: string
}

export class TencentCOSUploader implements OSSUploader {
  constructor(private readonly provider: TencentCloudCOS) { }

  async uploadFile(ctx: IUploadContext): Promise<void> {
    const { request, file } = ctx
    if (!file.mimeType) {
      throw new Error(`No mime type found for file ${file.filename}`)
    }

    const signature = this.generateSignature(file.remoteFilePath)
    const buffer = fs.readFileSync(file.localFilePath)

    const result = await request.request({
      method: 'PUT',
      url: `${this.provider.secure ? 'https' : 'http'}://${this.provider.bucket}.${this.getEndpoint}/${encodeURI(file.remoteFilePath)}`,
      headers: {
        'Host': `${this.provider.bucket}.${this.getEndpoint}`,
        'Authorization': 'q-sign-algorithm=sha1'
          + `&q-ak=${this.provider.secretId}`
          + `&q-sign-time=${signature.signTime}`
          + `&q-key-time=${signature.signTime}`
          + `&q-header-list=host`
          + `&q-url-param-list=`
          + `&q-signature=${signature.signature}`,
        'Content-Type': file.mimeType,
      },
      data: buffer,
    })

    if (result.status !== 200) {
      throw new Error('Upload failed')
    }
  }

  /**
   * @href https://cloud.tencent.com/document/product/436/7778
   */
  private generateSignature(path: string): ISignature {
    const now = Math.floor(new Date().getTime() / 1000)
    const nextDay = now + 24 * 60 * 60 // 1 day later
    const signTime = `${now};${nextDay}`
    const signKey = crypto.createHmac('sha1', this.provider.secretKey).update(signTime).digest('hex')
    const httpString = `put\n/${path}\n\nhost=${this.provider.bucket}.${this.getEndpoint}\n`
    const sha1edHttpString = crypto.createHash('sha1').update(httpString).digest('hex')
    const stringToSign = `sha1\n${signTime}\n${sha1edHttpString}\n`
    const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex')

    return {
      signature,
      signTime,
    }
  }

  private get getEndpoint(): string {
    return this.provider.endpoint ? this.provider.endpoint : `cos.${this.provider.region}.myqcloud.com`
  }
}
