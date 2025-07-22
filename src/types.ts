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

export interface CustomProvider {
  name: 'custom'
  upload: (file: OSSFile, options: OssOptions) => Promise<void>
}

export type Provider = AliyunOSSProvider | TencentCloudCOS | CustomProvider

export interface OSSFile {
  filename: string
  localFilePath: string
  remoteFilePath: string
  mimeType?: string
  contentType?: string
}

/**
 * Interface for all OSS provider implementations
 */
export interface OSSUploader {
  /**
   * Upload a single file to OSS
   * @param file file
   * @param options Additional upload options
   */
  uploadFile: (file: OSSFile, options: OssOptions) => Promise<void>
}

export interface OssOptions {
  /**
   * OSS service provider
   */
  provider: Provider

  /**
   * Local directory path where files will be uploaded
   * Should be a relative path
   */
  target: string

  /**
   * Remote directory path where files will be uploaded from
   */
  destination: string

  /**
   * Current working directory for resolving relative paths
   * Defaults to process.cwd() if not specified
   */
  cwd?: string

  /**
   * Ignore files during upload, support glob patterns
   */
  ignoreFiles?: string[]
}
