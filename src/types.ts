import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { Buffer } from 'node:buffer'

export interface IRequest {
  setDefaults: (config: AxiosRequestConfig) => void
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

  /**
   * Event triggered
   */
  onDestroy?: () => PromiseLike<void> | void
}

export interface AliyunOSSProvider {
  /**
   * 阿里云对象存储OSS（Object Storage Service）
   * @href https://help.aliyun.com/zh/oss
   */
  name: 'aliyun-oss'

  /**
   * AccessKey ID
   */
  accessKeyId: string

  /**
   * AccessKey Secret
   */
  accessKeySecret: string

  /**
   * 存储空间（Bucket）
   */
  bucket: string

  /**
   * 外网Endpoint e.g. oss-cn-hangzhou.aliyuncs.com
   */
  endpoint?: string

  /**
   * OSS 专用地域ID (Region) e.g. oss-cn-shenzhen
   * @href https://help.aliyun.com/zh/oss/user-guide/regions-and-endpoints
   */
  region?: string

  /**
   * instruct OSS client to use HTTPS (secure: true) or HTTP (secure: false) protocol.
   */
  secure?: boolean
}

export interface TencentCloudCOSProvider {
  name: 'tencent-cloud-cos'

  /**
   * Secret Id
   */
  secretId: string

  /**
   * Secret Key
   */
  secretKey: string

  /**
   * 存储桶（Bucket) 存储桶名称由[自定义名称]-[开发商 APPID]构成 e.g. <名称>-1234567890
   */
  bucket: string

  /**
   * 地域（Region）e.g. ap-guangzhou
   * @href https://cloud.tencent.com/document/product/436/6224
   */
  region: string

  /**
   * endpoint 是 COS 访问域名信息 e.g. cos.ap-guangzhou.myqcloud.com
   * @href https://cloud.tencent.com/document/product/436/12296
   */
  endpoint?: string

  /**
   * instruct OSS client to use HTTPS (secure: true) or HTTP (secure: false) protocol.
   */
  secure?: boolean
}

/**
 * @see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/ssh2/index.d.ts#L714
 */
export interface SSHProvider {
  name: 'ssh'
  /**
   * Hostname or IP address of the server
   */
  host?: string

  /**
   * Port number of the server.
   */
  port?: number

  /**
   * Username for authentication.
   */
  username?: string

  /**
   * Password for password-based user authentication.
   */
  password?: string

  /**
   * Path to the private key file for key-based authentication.
   */
  privateKeyPath?: string

  /**
   * Buffer that contains a private key for either key-based or hostbased user authentication (OpenSSH format).
   */
  privateKey?: Buffer

  /**
   * Allow additional properties for flexibility
   *
   * @link https://github.com/steelbrain/node-ssh
   */
  [x: string]: any
}

export interface CustomProvider {
  name: 'custom'
  upload: OSSUploader['uploadFile']
}

export type Provider = AliyunOSSProvider | TencentCloudCOSProvider | SSHProvider | CustomProvider

export interface OnStartOptions {
  setRequestDefault: IRequest['setDefaults']
}

export interface IUploadEvent {
  onStart?: (total: number, opt: OnStartOptions) => void | PromiseLike<void>
  onProgress?: (file: OSSFile, current: number, total: number, error?: unknown) => void | PromiseLike<void>
  onFinish?: (total: number, failFiles: OSSFile[]) => void | PromiseLike<void>
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

  /**
   * Remove files from local after successful upload
   * @default false
   */
  removeWhenUploaded?: boolean

  /**
   * Abort the upload process if any file fails to upload
   * @default false
   */
  abortOnFailure?: boolean

  /**
   * Additional retry attempts after the first failed attempt when uploading a file.
   * For example: retryTimes = 2 means each file can be tried up to 3 times (1 initial + 2 retries).
   * @default 0
   */
  retryTimes?: number

  /**
   * Enable or disable logging
   * @default true
   */
  logger?: boolean

  /**
   * Directory to store log files, defaults to current working directory
   * @default node_modules/.ossx
   */
  logDir?: string

  /**
   * Maximum number of log files to keep, not specified means no limit
   */
  maxLogfiles?: number
}
