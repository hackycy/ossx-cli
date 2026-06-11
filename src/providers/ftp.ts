import type { FTPProvider, IUploadContext, OSSUploader } from '../types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'basic-ftp'

export class FTPUploader implements OSSUploader {
  private client: Client
  private connected = false
  private createdDirs = new Set<string>()

  constructor(
    private readonly provider: FTPProvider,
    private readonly backup = false,
    private readonly maxBackups = 5,
  ) {
    this.client = new Client(provider.connTimeout ?? 30_000)
  }

  private async connect(): Promise<void> {
    await this.client.access({
      host: this.provider.host,
      port: this.provider.port ?? 21,
      user: this.provider.username,
      password: this.provider.password,
      secure: this.provider.secure ?? false,
      secureOptions: this.provider.secureOptions as any,
    })

    this.connected = true
  }

  private toAbsolute(p: string): string {
    return p.startsWith('/') ? p : `/${p}`
  }

  private async ensureDir(remotePath: string): Promise<void> {
    const absPath = this.toAbsolute(remotePath)
    const dir = path.posix.dirname(absPath)
    if (!dir || dir === '.' || this.createdDirs.has(dir)) {
      return
    }

    await this.client.ensureDir(dir)
    this.createdDirs.add(dir)

    await this.client.cd('/')
  }

  async preUpload(ctx: { destination?: string, backupDir?: string }): Promise<void> {
    if (!this.backup || !ctx.destination) {
      return
    }

    if (!this.connected) {
      await this.connect()
    }

    const dest = this.toAbsolute(ctx.destination)
    const backupDirName = ctx.backupDir || '.backups'

    // Check if destination directory exists
    let destExists = false
    try {
      await this.client.cd(dest)
      destExists = true
      await this.client.cd('/')
    }
    catch {
      destExists = false
    }

    if (!destExists) {
      return
    }

    // List all files in destination recursively (excluding backupDir)
    const remoteFiles = await this.listRemoteFiles(dest, backupDirName)

    if (remoteFiles.length === 0) {
      return
    }

    // Download to local temp
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ossx-backup-'))

    try {
      for (const relPath of remoteFiles) {
        const localPath = path.join(tmpDir, relPath)
        fs.mkdirSync(path.dirname(localPath), { recursive: true })
        const writeStream = fs.createWriteStream(localPath)
        await this.client.downloadTo(writeStream, `${dest}/${relPath}`)
      }

      // Create remote backup directory and upload
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      const remoteBackupDir = `${dest}/${backupDirName}/${timestamp}`
      await this.client.ensureDir(remoteBackupDir)
      await this.client.cd('/')

      for (const relPath of remoteFiles) {
        const localPath = path.join(tmpDir, relPath)
        const remotePath = `${remoteBackupDir}/${relPath}`
        const remoteDir = path.posix.dirname(remotePath)
        await this.client.ensureDir(remoteDir)
        await this.client.cd('/')
        await this.client.uploadFrom(localPath, remotePath)
      }

      // Rotate old backups
      await this.rotateBackups(`${dest}/${backupDirName}`)
    }
    finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  /**
   * List all files in a remote directory recursively, returning relative paths.
   * Excludes the specified backup directory.
   */
  private async listRemoteFiles(dir: string, excludeDir: string): Promise<string[]> {
    const results: string[] = []

    await this.client.cd(dir)
    const list = await this.client.list('.')
    await this.client.cd('/')

    for (const item of list) {
      // Skip the backup subdirectory and navigation entries
      if (item.name === '.' || item.name === '..' || item.name === excludeDir) {
        continue
      }

      if (item.type === 1) {
        // file
        results.push(item.name)
      }
      else if (item.type === 2) {
        // directory - recurse
        const subFiles = await this.listRemoteFiles(`${dir}/${item.name}`, excludeDir)
        for (const sub of subFiles) {
          results.push(`${item.name}/${sub}`)
        }
      }
    }

    return results
  }

  private async rotateBackups(backupParentDir: string): Promise<void> {
    try {
      await this.client.cd(backupParentDir)
      const list = await this.client.list('.')
      await this.client.cd('/')

      const backups = list
        .filter(item => item.isDirectory && item.name !== '.' && item.name !== '..')
        .map(item => item.name)
        .sort()
        .reverse()

      for (const old of backups.slice(this.maxBackups)) {
        try {
          await this.client.removeDir(`${backupParentDir}/${old}`)
        }
        catch {
          // Best effort removal
        }
      }
    }
    catch {
      // Best effort rotation
    }
  }

  async uploadFile(ctx: IUploadContext): Promise<void> {
    if (!this.connected) {
      await this.connect()
    }

    const { file } = ctx
    const remotePath = this.toAbsolute(file.remoteFilePath)

    await this.ensureDir(remotePath)

    await this.client.uploadFrom(file.localFilePath, remotePath)
  }

  onDestroy(): void {
    this.client.close()
  }
}
