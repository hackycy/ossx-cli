import type { OSSFile, UploadOptions, WorkerMessage } from './types'
import fs from 'node:fs'
import process from 'node:process'
import { isMainThread, parentPort, workerData } from 'node:worker_threads'
import { createUploader } from './providers'

if (isMainThread) {
  throw new Error('Unexpected main thread execution')
}

const { workerId, files, options } = workerData as { workerId: number, files: OSSFile[], options: UploadOptions }

class UploadWorker {
  private workerId: number
  private files: OSSFile[]
  private options: UploadOptions

  constructor(workerId: number, files: OSSFile[] = [], options: UploadOptions) {
    this.workerId = workerId
    this.files = files
    this.options = options
  }

  async start(): Promise<void> {
    const uploader = createUploader(this.options.provider)

    // track failed files
    const failFiles: OSSFile[] = []

    // upload files sequentially
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i]

      // Upload the file using the provider's strategy with retry
      const maxRetry = Number.isInteger(this.options.retryTimes) && (this.options.retryTimes as number) > 0 ? (this.options.retryTimes as number) : 0
      let attempt = 0
      let uploadError: unknown | undefined

      while (attempt <= maxRetry) {
        try {
          await uploader.uploadFile({
            file,
          })

          if (options.removeWhenUploaded) {
            try {
              fs.rmSync(file.localFilePath, { force: true })
            }
            catch {
              // ignore
            }
          }

          // success, break retry loop
          uploadError = undefined
          break
        }
        catch (err) {
          uploadError = err

          if (attempt === maxRetry) {
            failFiles.push(file)
          }
          else {
            // small delay before retry to avoid hot loop; 100ms
            await new Promise(r => setTimeout(r, 100))
          }
        }
        attempt++
      }

      this.sendMessage({
        type: uploadError ? 'ERROR' : 'PROGRESS',
        workerId: this.workerId,
        error: uploadError || undefined,
        progress: {
          currentFile: file,
          current: i + 1,
          total: this.files.length,
        },
      })
    }

    this.sendMessage({
      type: 'COMPLETE',
      workerId: this.workerId,
      result: {
        total: this.files.length,
        succeeded: this.files.length - failFiles.length,
      },
    })

    uploader.onDestroy?.()
  }

  sendMessage(message: WorkerMessage): void {
    if (parentPort) {
      parentPort.postMessage(message)
    }
  }
}

const worker = new UploadWorker(workerId, files, options)
worker.start().catch((error) => {
  worker.sendMessage({
    type: 'ERROR',
    workerId,
    error,
  })

  process.exit(1)
})
