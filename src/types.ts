import type { AxiosRequestConfig, AxiosResponse } from 'axios'

export interface IRequest {
  request: <T, U>(config: AxiosRequestConfig<U>) => Promise<AxiosResponse<T, U>>
}

export interface OSSFile {
  filename: string
  localFilePath: string
  remoteFilePath: string
  mimeType?: string
  contentType?: string
}

export interface IUploadContext {
  file: OSSFile
  request: IRequest
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
  uploadFile: (ctx: IUploadContext) => PromiseLike<void> | void
}

export interface AliyunOSSProvider {
  name: 'aliyun-oss'
  accessKeyId: string
  accessKeySecret: string
  /**
   * 存储空间（Bucket）
   */
  bucket: string

  /**
   * OSS 访问入口 (Endpoint)
   * @href https://help.aliyun.com/zh/oss/user-guide/regions-and-endpoints
   */
  endpoint: string

  /**
   * instruct OSS client to use HTTPS (secure: true) or HTTP (secure: false) protocol.
   */
  secure?: boolean
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
  upload: OSSUploader['uploadFile']
}

export type Provider = AliyunOSSProvider | TencentCloudCOS | CustomProvider

export interface IUploadEvent {
  onStart?: (total: number) => void
  onProgress?: (file: OSSFile, current: number, total: number) => void
  onComplete?: (file: OSSFile, error?: unknown) => void
  onFinish?: (total: number, fail: number) => void
}

export interface OssOptions extends IUploadEvent {
  /**
   * OSS service provider
   */
  provider: Provider

  /**
   * Local directory path where files will be uploaded
   * Should be a relative path
   * @default 'dist'
   */
  target?: string

  /**
   * Remote directory path where files will be uploaded from
   */
  destination?: string

  /**
   * Current working directory for resolving relative paths
   * Defaults to process.cwd() if not specified
   * @default process.cwd()
   */
  cwd?: string

  /**
   * Include files during upload, support glob patterns
   */
  includeFiles?: string[]

  /**
   * Ignore files during upload, support glob patterns
   */
  ignoreFiles?: string[] | ((file: OSSFile) => PromiseLike<boolean | undefined> | boolean | undefined)
}
