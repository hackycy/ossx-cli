import type { IUploadContext, OSSUploader, SSHProvider } from '../types'
import { NodeSSH } from 'node-ssh'

export class SSHUploader implements OSSUploader {
  private ssh: NodeSSH

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

    await this.ssh.putFile(file.localFilePath, file.remoteFilePath)
  }

  onDestroy(): void {
    this.ssh?.dispose()
  }
}
