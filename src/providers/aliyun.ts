import type { AliyunOSSProvider, OssOptions, OSSUploader } from '../types'

export class AliyunOSSUploader implements OSSUploader {
  constructor(private readonly provider: AliyunOSSProvider) {}

  async uploadFile(localFilePath: string, remoteFilePath: string, _options: OssOptions): Promise<void> {
    console.log(`Uploading ${localFilePath} to Aliyun OSS at ${remoteFilePath}`)
    console.log(`Using bucket: ${this.provider.bucket} in region: ${this.provider.area}`)
  }
}
