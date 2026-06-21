import type { OSSFile, UploadOptions, WorkerMessage } from './types'
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
    const failFiles: OSSFile[] = []

    try {
      // A worker handles its own queue sequentially. Parallelism is provided
      // by UploadMaster creating multiple workers.
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i]
        const maxRetry = Number.isInteger(this.options.retryTimes) && (this.options.retryTimes as number) > 0 ? (this.options.retryTimes as number) : 0
        let attempt = 0
        let uploadError: unknown | undefined

        while (attempt <= maxRetry) {
          try {
            await uploader.uploadFile({ file })
            uploadError = undefined
            break
          }
          catch (error) {
            uploadError = error
            if (attempt < maxRetry) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          attempt++
        }

        if (uploadError) {
          failFiles.push(file)
        }

        this.sendMessage({
          type: uploadError ? 'ERROR' : 'PROGRESS',
          workerId: this.workerId,
          error: uploadError,
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
    }
    finally {
      await uploader.onDestroy?.()
    }
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
