import type { OSSFile, OssOptions, OSSUploader, TencentCloudCOS } from '../types'

export class TencentCOSUploader implements OSSUploader {
  constructor(private readonly provider: TencentCloudCOS) { }

  async uploadFile(_file: OSSFile, _options: OssOptions): Promise<void> {
    // TODO
  }
}
