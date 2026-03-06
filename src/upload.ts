import type { ProgressResult } from '@clack/prompts'
import type { UserProviderConfig, UserProviderMultiConfig } from './config'
import type { OSSFile, Provider, TaskResult, UploadOptions, WorkerMessage } from './types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Worker } from 'node:worker_threads'
import { cancel, confirm, isCancel, log, progress, select } from '@clack/prompts'
import ansis from 'ansis'
import mime from 'mime-types'
import { glob } from 'tinyglobby'
import { loadConfigFromFile } from './config'
import { Logger } from './logger'
import { clearScreen, combineURLs } from './utils'

/**
 * upload oss files
 */
export async function upload(configFile?: string): Promise<void> {
  clearScreen()

  console.log(`${ansis.bold.cyanBright('OSSX CLI')}`)
  console.log()

  // load config
  const config = await loadConfigFromFile(configFile)

  // active provider
  let provider: Provider | undefined

  if (Reflect.has(config, 'provider')) {
    provider = (config as UserProviderConfig).provider
  }
  else if (Reflect.has(config, 'providers')) {
    const providers = (config as UserProviderMultiConfig).providers
    if (providers.length === 1) {
      provider = providers[0].provider
    }
    else if (providers.length > 1) {
      // for ci
      if (process.env.OSSX_CI_PROVIDER_TAG) {
        const matched = providers.find(item => item.tag === process.env.OSSX_CI_PROVIDER_TAG)
        if (matched) {
          provider = matched.provider
          log.step(`Using provider ${ansis.cyan.bold(matched.tag)} from environment variable ${ansis.gray('OSSX_CI_PROVIDER_TAG')}`)
        }
        else {
          cancel(`No provider matched for tag ${ansis.yellowBright.bold(process.env.OSSX_CI_PROVIDER_TAG)}. Check your config file and try again.`)
          return
        }
      }
      else {
        // prompt select provider
        const selected = await select({
          message: 'Multiple providers configured, please select one to use',
          options: providers.map(item => ({
            value: item.tag,
            label: item.tag,
            hint: item.provider.name,
          })),
        })

        if (isCancel(selected)) {
          cancel('Operation cancelled.')
          return
        }

        // 多选时需要二次确认，确保操作
        const shouldContinue = await confirm({
          message: `You have selected the provider ${ansis.cyan.bold(selected)}, confirm to continue`,
        })

        if (isCancel(shouldContinue) || !shouldContinue) {
          cancel('Operation cancelled.')
          return
        }

        provider = providers.find(item => item.tag === selected)?.provider
      }
    }
  }

  if (!provider) {
    cancel('No provider configured')
    return
  }

  if (!config.target) {
    cancel('No target directory specified')
    return
  }

  const targetDir = path.resolve(config.cwd || process.cwd(), config.target)

  if (!fs.existsSync(targetDir)) {
    cancel(`Target directory does not exist: ${targetDir}`)
    return
  }

  // Define patterns to include/exclude
  const patterns = Array.isArray(config.includeFiles) ? config.includeFiles : ['**/*']
  const ignorePatterns = Array.isArray(config.ignoreFiles) ? config.ignoreFiles : undefined

  // Get all files in the target directory
  const globFiles = await glob(patterns, {
    cwd: targetDir,
    ignore: ignorePatterns,
    dot: true,
    absolute: false,
    onlyFiles: true,
  })

  const ossFiles: OSSFile[] = globFiles.map((globFile) => {
    const localFilePath = path.join(targetDir, globFile)

    const filename = path.basename(localFilePath)
    const mimeType = mime.lookup(filename)
    const contentType = mime.contentType(filename)

    // Calculate the remote path - OSS always uses forward slashes (/) regardless of OS
    // Normalize the path to ensure consistent handling across platforms
    const normalizedPath = globFile.split(path.sep).join('/')
    const remoteFilePath = config.destination ? combineURLs(config.destination, normalizedPath) : normalizedPath

    return {
      localFilePath,
      remoteFilePath,
      filename,
      mimeType: mimeType || undefined,
      contentType: contentType || undefined,
    }
  })

  if (ossFiles.length === 0) {
    cancel('No files found to upload.')
    return
  }

  const master = new UploadMaster(ossFiles, { ...config, provider })
  await master.start()
}

class UploadMaster {
  private files: OSSFile[]
  private options: UploadOptions
  private maxWorkers: number

  private logger?: Logger

  private workers: Worker[] = []
  private taskQueues: OSSFile[][] = []

  private workerDeadlineMap: Map<number, boolean> = new Map()
  private workerResultMap: Map<number, TaskResult> = new Map()

  private progressController: ProgressResult

  constructor(files: OSSFile[], options: UploadOptions) {
    this.files = files
    this.options = options
    this.logger = this.options.logger ? new Logger(path.resolve(options.logDir!), options) : undefined

    const maxWorkers = options.maxWorkers && options.maxWorkers > 0 ? options.maxWorkers : os.cpus().length
    // 最大不超过文件数
    this.maxWorkers = Math.min(maxWorkers, files.length)

    this.progressController = progress({
      indicator: 'timer',
      max: this.files.length,
      style: 'block',
    })
  }

  public async start(): Promise<void> {
    log.info(`Starting upload of ${ansis.green.bold(this.files.length)} files using ${ansis.yellowBright.bold(this.maxWorkers)} workers`)
    this.initialize()

    this.progressController.start(`Uploading files to ${ansis.cyan.bold(this.options.provider.name)}...`)
    await this.startWorkers()
  }

  private initialize(): void {
    // initialize task queues
    this.taskQueues = Array.from({ length: this.maxWorkers }, () => [])

    for (let i = 0; i < this.files.length; i++) {
      const batchIndex = i % this.maxWorkers
      this.taskQueues[batchIndex].push(this.files[i])
    }
  }

  private async startWorkers(): Promise<void> {
    const workerPromises = []

    for (let i = 0; i < this.maxWorkers; i++) {
      workerPromises.push(this.createWorker(i))
    }

    await Promise.all(workerPromises)
  }

  private async createWorker(workerId: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const worker = new Worker(new URL('./upload.worker.mjs', import.meta.url), {
        workerData: {
          workerId,
          files: this.taskQueues[workerId],
          options: this.options,
        },
      })

      this.workers.push(worker)

      this.workerDeadlineMap.set(workerId, false)
      this.workerResultMap.set(workerId, { total: this.taskQueues[workerId].length, succeeded: 0 })

      // 监听消息
      worker.on('message', (message: WorkerMessage) => {
        this.handleWorkerMessage(workerId, message)
      })

      worker.on('error', (error) => {
        this.handleWorkerMessage(workerId, {
          type: 'ERROR',
          error: error.message,
        })
      })

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.handleWorkerMessage(workerId, {
            type: 'ERROR',
            error: `Worker stopped with exit code ${code}`,
          })
        }

        // 标记工作进程已完成
        this.markWorkerDead(workerId)
      })

      worker.on('online', () => {
        resolve()
      })
    })
  }

  private markWorkerDead(workerId: number): void {
    this.workerDeadlineMap.set(workerId, true)

    // check if all workers are dead
    const allDead = Array.from(this.workerDeadlineMap.values()).every(isDead => isDead)

    if (allDead) {
      // statistics upload result
      const totalFiles = this.files.length
      let successCount = 0
      let failCount = 0

      for (const result of this.workerResultMap.values()) {
        successCount += result.succeeded
      }

      failCount = totalFiles - successCount

      // 记录日志
      this.logger?.logTaskCompletion(totalFiles, successCount, failCount)

      if (failCount <= 0) {
        this.progressController.stop('All files uploaded successfully')
      }
      else {
        this.progressController.stop(`Uploaded ${ansis.bold.green(successCount)} files successfully`)
        log.warning(`Failed to upload ${ansis.bold.red(failCount)} files`)
      }

      if (this.options.logger) {
        log.warning(`Log output: ${ansis.underline.blue(this.logger?.getLogPath())}`)
      }

      log.success('Upload process completed ✨')
    }
  }

  private async handleWorkerMessage(workerId: number, message: WorkerMessage): Promise<void> {
    if (message.type === 'ERROR') {
      const cause = message.progress ? `Progress on file ${message.progress.currentFile.localFilePath}` : `Worker ${workerId} has broken`
      this.logger?.logError(cause, message.error)
      if (this.options.abortOnFailure) {
        cancel(`${cause}. Check log for details (${ansis.gray('aborting...')})`)
        process.exit(1)
      }
    }
    else if (message.type === 'PROGRESS') {
      this.progressController.advance(1, `${ansis.dim(message.progress!.currentFile.filename)}`)
    }
    else if (message.type === 'COMPLETE') {
      if (message.result) {
        this.workerResultMap.set(workerId, message.result)
      }
    }
  }
}
