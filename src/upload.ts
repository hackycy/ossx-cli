import type { ProgressResult } from '@clack/prompts'
import type { UserConfig } from './config'
import type {
  OSSFile,
  OssOptions,
  PipelineResult,
  PipelineStepResult,
  ProviderConfigItem,
  TaskResult,
  UploadOptions,
  UploadTaskResult,
  WorkerMessage,
} from './types'
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
import { createUploader } from './providers'
import { clearScreen, combineURLs } from './utils'

interface ResolvedUploadTask {
  tag: string
  options: UploadOptions
}

interface PreparedUploadTask extends ResolvedUploadTask {
  files: OSSFile[]
}

/**
 * Load the user configuration and execute either one selected provider or an
 * explicitly configured provider pipeline.
 */
export async function upload(configFile?: string): Promise<PipelineResult | undefined> {
  clearScreen()
  console.log(ansis.bold.cyanBright('OSSX CLI'))
  console.log()

  const config = await loadConfigFromFile(configFile)
  const tasks = await resolveUploadTasks(config)
  if (!tasks) {
    return undefined
  }

  // Prepare every step before the first remote side effect. Invalid paths,
  // empty file sets and bad pipeline references therefore fail atomically.
  const preparedTasks = await Promise.all(tasks.map(prepareUploadTask))
  return runPipeline(preparedTasks)
}

export async function resolveUploadTasks(config: UserConfig): Promise<ResolvedUploadTask[] | undefined> {
  if ('provider' in config) {
    const { provider, ...options } = config
    return [{ tag: provider.name, options: { ...options, provider } }]
  }

  const { providers, pipeline, ...rootOptions } = config
  validateProviders(providers)

  if (pipeline !== undefined) {
    if (!Array.isArray(pipeline)) {
      throw new TypeError('Pipeline must be an array of provider tags')
    }
    if (pipeline.length === 0) {
      throw new Error('Pipeline must contain at least one provider tag')
    }

    return pipeline.map((tag) => {
      if (typeof tag !== 'string' || !tag.trim()) {
        throw new Error('Pipeline provider tags must be non-empty strings')
      }
      const profile = providers.find(item => item.tag === tag)
      if (!profile) {
        throw new Error(`Pipeline references unknown provider tag: ${tag}`)
      }
      return resolveProfile(profile, rootOptions)
    })
  }

  const profile = await selectProvider(providers)
  return profile ? [resolveProfile(profile, rootOptions)] : undefined
}

function validateProviders(providers: ProviderConfigItem[]): void {
  if (!Array.isArray(providers)) {
    throw new TypeError('Providers must be an array')
  }
  if (providers.length === 0) {
    throw new Error('No provider configured')
  }

  const tags = new Set<string>()
  for (const profile of providers) {
    if (typeof profile.tag !== 'string' || !profile.tag.trim()) {
      throw new Error('Provider tag cannot be empty')
    }
    if (!profile.provider || typeof profile.provider.name !== 'string') {
      throw new Error(`No provider configured for tag: ${profile.tag}`)
    }
    if (tags.has(profile.tag)) {
      throw new Error(`Duplicate provider tag: ${profile.tag}`)
    }
    tags.add(profile.tag)
  }
}

async function selectProvider(providers: ProviderConfigItem[]): Promise<ProviderConfigItem | undefined> {
  if (providers.length === 1) {
    return providers[0]
  }

  if (process.env.OSSX_CI_PROVIDER_TAG) {
    const matched = providers.find(item => item.tag === process.env.OSSX_CI_PROVIDER_TAG)
    if (!matched) {
      throw new Error(`No provider matched OSSX_CI_PROVIDER_TAG=${process.env.OSSX_CI_PROVIDER_TAG}`)
    }
    log.step(`Using provider ${ansis.cyan.bold(matched.tag)} from environment variable ${ansis.gray('OSSX_CI_PROVIDER_TAG')}`)
    return matched
  }

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
    return undefined
  }

  const shouldContinue = await confirm({
    message: `You have selected the provider ${ansis.cyan.bold(selected)}, confirm to continue`,
  })
  if (isCancel(shouldContinue) || !shouldContinue) {
    cancel('Operation cancelled.')
    return undefined
  }

  return providers.find(item => item.tag === selected)
}

function resolveProfile(profile: ProviderConfigItem, rootOptions: OssOptions): ResolvedUploadTask {
  const { tag, provider, ...profileOptions } = profile
  return {
    tag,
    options: {
      ...rootOptions,
      ...profileOptions,
      provider,
    },
  }
}

async function prepareUploadTask(task: ResolvedUploadTask): Promise<PreparedUploadTask> {
  const { options } = task
  if (!options.target) {
    throw new Error(`No target directory specified for provider ${task.tag}`)
  }

  const targetDir = path.resolve(options.cwd || process.cwd(), options.target)
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error(`Target directory does not exist: ${targetDir}`)
  }

  const globFiles = await glob(options.includeFiles || ['**/*'], {
    cwd: targetDir,
    ignore: options.ignoreFiles,
    dot: true,
    absolute: false,
    onlyFiles: true,
  })

  const files = globFiles.map((globFile): OSSFile => {
    const localFilePath = path.join(targetDir, globFile)
    const filename = path.basename(localFilePath)
    const normalizedPath = globFile.split(path.sep).join('/')
    return {
      localFilePath,
      remoteFilePath: options.destination ? combineURLs(options.destination, normalizedPath) : normalizedPath,
      filename,
      mimeType: mime.lookup(filename) || undefined,
      contentType: mime.contentType(filename) || undefined,
    }
  })

  if (files.length === 0) {
    throw new Error(`No files found to upload for provider ${task.tag}`)
  }

  return { ...task, files }
}

async function runPipeline(tasks: PreparedUploadTask[]): Promise<PipelineResult> {
  const startedAt = Date.now()
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const results: PipelineStepResult[] = []
  const filesToRemove = new Set<string>()
  const pipelineLoggers = new Map<string, Logger>()

  log.info(`Upload plan: ${tasks.map(task => ansis.cyan.bold(task.tag)).join(ansis.dim(' -> '))}`)

  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index]
    const startedAt = Date.now()
    log.step(`Step ${index + 1}/${tasks.length}: ${ansis.cyan.bold(task.tag)} (${task.options.provider.name})`)

    const master = new UploadMaster(task.files, task.options, task.tag, runId)
    const taskResult = await master.start()
    const taskLogger = master.getLogger()
    if (taskLogger) {
      pipelineLoggers.set(taskLogger.getLogPath(), taskLogger)
    }
    const stepResult: PipelineStepResult = {
      ...taskResult,
      tag: task.tag,
      provider: task.options.provider,
      elapsedMs: Date.now() - startedAt,
    }
    results.push(stepResult)

    if (taskResult.failed > 0) {
      log.error(`Pipeline stopped at ${ansis.red.bold(task.tag)} because ${taskResult.failed} file(s) failed`)
      for (const logger of pipelineLoggers.values()) {
        logger.logPipelineCompletion(tasks.length, results, false, [], Date.now() - startedAt)
      }
      return { succeeded: false, steps: results, cleanupFailedFiles: [] }
    }

    if (task.options.removeWhenUploaded) {
      task.files.forEach(file => filesToRemove.add(file.localFilePath))
    }
  }

  // Deletion is deliberately delayed until every provider has succeeded, so
  // an earlier step cannot remove input required by a later step.
  const cleanupFailedFiles: string[] = []
  for (const file of filesToRemove) {
    try {
      fs.rmSync(file, { force: true })
    }
    catch (error) {
      cleanupFailedFiles.push(file)
      log.warning(`Uploaded successfully, but failed to remove local file ${ansis.yellow(file)}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  for (const logger of pipelineLoggers.values()) {
    logger.logPipelineCompletion(tasks.length, results, true, cleanupFailedFiles, Date.now() - startedAt)
  }

  const cleanupSuffix = cleanupFailedFiles.length > 0 ? ` (${cleanupFailedFiles.length} local file(s) could not be removed)` : ''
  log.success(`Pipeline completed: ${results.length}/${tasks.length} step(s) succeeded${cleanupSuffix} ✨`)
  return { succeeded: true, steps: results, cleanupFailedFiles }
}

class UploadMaster {
  private maxWorkers: number
  private logger?: Logger
  private workers: Worker[] = []
  private taskQueues: OSSFile[][] = []
  private successfulFiles = new Set<string>()
  private aborting = false
  private progressStarted = false
  private progressController: ProgressResult

  constructor(
    private readonly files: OSSFile[],
    private readonly options: UploadOptions,
    private readonly taskTag: string,
    runId: string,
  ) {
    const maxWorkers = options.maxWorkers && options.maxWorkers > 0 ? options.maxWorkers : os.cpus().length
    this.maxWorkers = Math.min(maxWorkers, files.length)
    this.logger = options.logger ? new Logger(path.resolve(options.logDir || path.join('node_modules', '.ossx')), options, taskTag, runId) : undefined
    this.progressController = progress({
      indicator: 'timer',
      max: files.length,
      style: 'block',
    })
  }

  async start(): Promise<UploadTaskResult> {
    log.info(`Starting upload of ${ansis.green.bold(this.files.length)} files using ${ansis.yellowBright.bold(this.options.provider.name === 'custom' ? 1 : this.maxWorkers)} workers`)

    try {
      await this.runPreUpload()
    }
    catch (error) {
      this.logger?.logError(`Pre-upload hook for ${this.taskTag}`, error)
      return this.finish()
    }

    this.progressController.start(`Uploading files to ${ansis.cyan.bold(this.taskTag)}...`)
    this.progressStarted = true

    try {
      if (this.options.provider.name === 'custom') {
        await this.startInline()
      }
      else {
        this.initializeQueues()
        await Promise.all(this.taskQueues.map((_, workerId) => this.createWorker(workerId)))
      }
    }
    catch (error) {
      this.logger?.logError(`Upload task ${this.taskTag} failed unexpectedly`, error)
      await Promise.allSettled(this.workers.map(worker => worker.terminate()))
    }

    return this.finish()
  }

  private async runPreUpload(): Promise<void> {
    if (!this.options.backup) {
      return
    }

    const uploader = createUploader(this.options.provider, {
      backup: this.options.backup,
      maxBackups: this.options.maxBackups,
    })
    try {
      if (uploader.preUpload) {
        log.step('Running pre-upload backup...')
        await uploader.preUpload({
          destination: this.options.destination,
          backupDir: this.options.backupDir,
        })
      }
    }
    finally {
      await uploader.onDestroy?.()
    }
  }

  private initializeQueues(): void {
    this.taskQueues = Array.from({ length: this.maxWorkers }, () => [])
    this.files.forEach((file, index) => {
      this.taskQueues[index % this.maxWorkers].push(file)
    })
  }

  private createWorker(workerId: number): Promise<TaskResult> {
    return new Promise((resolve) => {
      let result: TaskResult = { total: this.taskQueues[workerId].length, succeeded: 0 }
      const worker = new Worker(new URL('./upload.worker.mjs', import.meta.url), {
        workerData: {
          workerId,
          files: this.taskQueues[workerId],
          options: this.options,
        },
      })
      this.workers.push(worker)

      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'COMPLETE' && message.result) {
          result = message.result
        }
        this.handleWorkerMessage(workerId, message)
      })

      worker.on('error', (error) => {
        this.handleWorkerMessage(workerId, { type: 'ERROR', error })
      })

      worker.on('exit', (code) => {
        if (code !== 0 && !this.aborting) {
          this.handleWorkerMessage(workerId, {
            type: 'ERROR',
            error: new Error(`Worker stopped with exit code ${code}`),
          })
        }
        resolve(result)
      })
    })
  }

  private async startInline(): Promise<void> {
    const uploader = createUploader(this.options.provider)
    try {
      for (let index = 0; index < this.files.length; index++) {
        const file = this.files[index]
        const error = await this.uploadWithRetry(() => uploader.uploadFile({ file }))
        this.handleWorkerMessage(0, {
          type: error ? 'ERROR' : 'PROGRESS',
          error,
          progress: { currentFile: file, current: index + 1, total: this.files.length },
        })
        if (error && this.options.abortOnFailure) {
          break
        }
      }
    }
    finally {
      await uploader.onDestroy?.()
    }
  }

  private async uploadWithRetry(uploadFile: () => PromiseLike<void> | void): Promise<unknown | undefined> {
    const maxRetry = Number.isInteger(this.options.retryTimes) && (this.options.retryTimes as number) > 0 ? this.options.retryTimes as number : 0
    let error: unknown
    for (let attempt = 0; attempt <= maxRetry; attempt++) {
      try {
        await uploadFile()
        return undefined
      }
      catch (cause) {
        error = cause
        if (attempt < maxRetry) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }
    return error
  }

  private handleWorkerMessage(workerId: number, message: WorkerMessage): void {
    if (message.type === 'ERROR') {
      const cause = message.progress ? `Upload failed for ${message.progress.currentFile.localFilePath}` : `Worker ${workerId} failed`
      this.logger?.logError(cause, message.error)
      if (message.progress) {
        this.progressController.advance(1, ansis.red(message.progress.currentFile.filename))
      }
      if (this.options.abortOnFailure && !this.aborting) {
        this.aborting = true
        cancel(`${cause} (${ansis.gray('aborting current step...')})`)
        for (const worker of this.workers) {
          void worker.terminate()
        }
      }
    }
    else if (message.type === 'PROGRESS' && message.progress) {
      this.successfulFiles.add(message.progress.currentFile.localFilePath)
      this.progressController.advance(1, ansis.dim(message.progress.currentFile.filename))
    }
  }

  private finish(): UploadTaskResult {
    const failedFiles = this.files.filter(file => !this.successfulFiles.has(file.localFilePath))
    const result: UploadTaskResult = {
      total: this.files.length,
      succeeded: this.successfulFiles.size,
      failed: failedFiles.length,
      failedFiles,
    }

    this.logger?.logTaskCompletion(result.total, result.succeeded, result.failed)
    if (this.progressStarted && result.failed === 0) {
      this.progressController.stop('All files uploaded successfully')
    }
    else if (this.progressStarted) {
      this.progressController.stop(`Uploaded ${ansis.bold.green(result.succeeded)} files successfully`)
    }
    if (result.failed > 0) {
      log.warning(`Failed to upload ${ansis.bold.red(result.failed)} files`)
    }
    if (this.options.logger) {
      log.info(`Log output: ${ansis.underline.blue(this.logger?.getLogPath())}`)
    }
    return result
  }

  getLogger(): Logger | undefined {
    return this.logger
  }
}
