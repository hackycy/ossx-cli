import type { CustomProvider, IUploadContext, OSSUploader } from '../types'

export class CustomUploader implements OSSUploader {
  constructor(private readonly provider: CustomProvider) {}

  async uploadFile(ctx: IUploadContext): Promise<void> {
    // Delegate to the custom upload function provided in the provider config
    await this.provider.upload(ctx)
  }
}
