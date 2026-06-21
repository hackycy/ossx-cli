import type { IUploadContext, OSSUploader, SSHProvider } from '../types'
import path from 'node:path'
import { NodeSSH } from 'node-ssh'

export class SSHUploader implements OSSUploader {
  private ssh: NodeSSH
  private createdDirs = new Set<string>()

  constructor(private readonly provider: SSHProvider) {
    this.ssh = new NodeSSH()
  }

  private async connect(): Promise<void> {
    await this.ssh.connect({
      ...this.provider,
    })
  }

  async uploadFile(ctx: IUploadContext): Promise<void> {
    if (!this.ssh.isConnected()) {
      await this.connect()
    }

    const { file } = ctx

    const remoteDir = path.posix.dirname(file.remoteFilePath)
    if (remoteDir && remoteDir !== '.' && !this.createdDirs.has(remoteDir)) {
      await this.ssh.mkdir(remoteDir, 'sftp')
      this.createdDirs.add(remoteDir)
    }

    await this.ssh.putFile(file.localFilePath, file.remoteFilePath)
  }

  onDestroy(): void {
    this.ssh?.dispose()
  }
}
