export type Uploader = (filePath: string, options: OssOptions) => Promise<void>

export interface AliyunOSSProvider {
  name: 'aliyun-oss'
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  area: string
}

export interface TencentCloudCOS {
  name: 'tencent-cloud-cos'
  secretId: string
  secretKey: string
  bucket: string
  appId: string
  area: string
}

export type Provider = AliyunOSSProvider | TencentCloudCOS

export interface OssOptions {
  /**
   * OSS service provider
   */
  provider: Provider

  /**
   * Local directory path where files will be uploaded
   */
  target: string

  /**
   * Remote directory path where files will be uploaded from
   */
  destination: string

  /**
   * Ignore files during upload, support glob patterns
   */
  ignoreFiles?: string[]

  /**
   * Function to transform the file path before uploading
   */
  onBeforeUpload?: (filePath: string) => string | undefined

  /**
   * Function to execute after the file has been uploaded
   */
  onAfterUpload?: (filePath: string) => void
}
