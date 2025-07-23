import type { IUploadContext, OSSUploader, TencentCloudCOS } from '../types'

export class TencentCOSUploader implements OSSUploader {
  constructor(private readonly provider: TencentCloudCOS) { }

  async uploadFile(_ctx: IUploadContext): Promise<void> {
    // TODO
  }
}
