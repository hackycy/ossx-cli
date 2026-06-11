import type { Buffer } from 'node:buffer'
import type { OSSUploader } from './uploader'

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

export interface FTPProvider {
  name: 'ftp'

  /**
   * Hostname or IP address of the FTP server
   */
  host: string

  /**
   * Port number of the FTP server
   * @default 21
   */
  port?: number

  /**
   * Username for authentication
   */
  username?: string

  /**
   * Password for authentication
   */
  password?: string

  /**
   * Use FTPS (FTP over TLS)
   * - false: plain FTP (default)
   * - true or 'explicit': explicit FTPS via STARTTLS
   * - 'implicit': implicit FTPS
   * @default false
   */
  secure?: boolean | 'implicit'

  /**
   * TLS options passed to tls.connect (e.g. for self-signed certs)
   */
  secureOptions?: object

  /**
   * Use passive mode
   * @default true
   */
  passive?: boolean

  /**
   * Connection timeout in milliseconds
   * @default 30000
   */
  connTimeout?: number

  /**
   * PASV timeout in milliseconds
   * @default 30000
   */
  pasvTimeout?: number

  /**
   * Keepalive interval in milliseconds
   * @default 10000
   */
  keepalive?: number
}

/**
 * Custom provider implementation
 */
export interface CustomProvider {
  name: 'custom'
  upload: OSSUploader['uploadFile']
}

export type Provider = AliyunOSSProvider | TencentCloudCOSProvider | SSHProvider | FTPProvider | CustomProvider
