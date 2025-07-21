import type { OssOptions, OSSUploader, TencentCloudCOS } from '../types'

export class TencentCOSUploader implements OSSUploader {
  constructor(private readonly provider: TencentCloudCOS) {}

  async uploadFile(localFilePath: string, remoteFilePath: string, _options: OssOptions): Promise<void> {
    console.log(`Uploading ${localFilePath} to Tencent Cloud COS at ${remoteFilePath}`)
    console.log(`Using bucket: ${this.provider.bucket} in region: ${this.provider.area}`)
  }
}
