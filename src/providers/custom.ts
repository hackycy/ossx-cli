import type { CustomProvider, OSSFile, OssOptions, OSSUploader } from '../types'

export class CustomUploader implements OSSUploader {
  constructor(private readonly provider: CustomProvider) {}

  async uploadFile(file: OSSFile, options: OssOptions): Promise<void> {
    // Delegate to the custom upload function provided in the provider config
    console.log(`Uploading ${file.filename} to custom provider with options`, file)
    await this.provider.upload(file, options)
  }
}
