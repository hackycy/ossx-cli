import type { AliyunOSSProvider, OSSFile, OssOptions, OSSUploader } from '../types'

export class AliyunOSSUploader implements OSSUploader {
  constructor(private readonly provider: AliyunOSSProvider) { }

  async uploadFile(_file: OSSFile, _options: OssOptions): Promise<void> {
    // TODO
  }
}
