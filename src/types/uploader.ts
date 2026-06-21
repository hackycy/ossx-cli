import type { Provider } from './providers'

export interface OSSFile {
  filename: string
  localFilePath: string
  remoteFilePath: string
  mimeType?: string
  contentType?: string
}

export interface IUploadContext {
  file: OSSFile
}

/**
 * Interface for all OSS provider implementations
 */
export interface OSSUploader {
  /**
   * Optional hook called once before any uploads begin.
   * Use for pre-upload operations like remote backup.
   */
  preUpload?: (ctx: { destination?: string, backupDir?: string }) => PromiseLike<void> | void

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

/**
 * A named upload profile. Options declared here override the root options when
 * this profile is selected or executed as part of a pipeline.
 */
export interface ProviderConfigItem extends Partial<OssOptions> {
  provider: Provider
  tag: string
}

export interface OssOptions {
  /**
   * Local directory path where files will be uploaded
   * Should be a relative path
   * @default 'dist'
   */
  target?: string

  /**
   * Current working directory for resolving paths, defaults to process.cwd()
   * @default process.cwd()
   */
  cwd?: string

  /**
   * Remote directory path where files will be uploaded from
   */
  destination?: string

  /**
   * Include files during upload, support glob patterns
   */
  includeFiles?: string[]

  /**
   * Ignore files during upload, support glob patterns
   */
  ignoreFiles?: string[]

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
   * @default 3
   */
  retryTimes?: number

  /**
   * Request timeout in milliseconds
   * @default 60000
   */
  requestTimeout?: number

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

  /**
   * Maximum number of worker threads for uploading files concurrently
   * @default os.cpus().length
   */
  maxWorkers?: number

  /**
   * Enable remote directory backup before upload (FTP provider only).
   * Existing remote files are downloaded to a local temp directory,
   * then re-uploaded to a timestamped backup subdirectory on the server.
   * @default false
   */
  backup?: boolean

  /**
   * Subdirectory name under destination to store backups.
   * Backups are organized as: <destination>/<backupDir>/<timestamp>/
   * @default '.backups'
   */
  backupDir?: string

  /**
   * Maximum number of remote backups to keep.
   * Only effective when backup is enabled.
   * @default 5
   */
  maxBackups?: number
}
