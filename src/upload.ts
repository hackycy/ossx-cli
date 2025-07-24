import type { OSSFile, OssOptions } from './types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import mime from 'mime-types'
import { glob } from 'tinyglobby'
import { createUploader } from './providers'
import Request from './request'
import { combineURLs, isNil } from './utils'

export async function uploadOSS(options: OssOptions): Promise<void> {
  if (!options.provider) {
    throw new Error('Provider is required')
  }

  if (!options.target) {
    throw new Error('Target directory is required')
  }

  // Create the appropriate uploader based on the provider
  const uploader = createUploader(options.provider)

  // Use provided cwd or default to process.cwd()
  const cwd = options.cwd || process.cwd()

  // Scan the target directory for files
  const targetDir = path.resolve(cwd, options.target)
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`)
  }

  // Define patterns to include/exclude
  const patterns = ['**/*']
  const ignorePatterns = Array.isArray(options.ignoreFiles) ? options.ignoreFiles : undefined

  // Get all files in the target directory
  const globFiles = await glob(patterns, {
    cwd: targetDir,
    ignore: ignorePatterns,
    dot: true,
    absolute: false,
  })

  // network request
  const request = new Request()

  for (const globFile of globFiles) {
    // Skip directories
    const localFilePath = path.join(targetDir, globFile)
    const stat = fs.statSync(localFilePath)
    if (stat.isDirectory()) {
      continue
    }

    const filename = path.basename(localFilePath)
    const mimeType = mime.lookup(filename)
    const contentType = mime.contentType(filename)

    // Calculate the remote path - OSS always uses forward slashes (/) regardless of OS
    // Normalize the path to ensure consistent handling across platforms
    const normalizedPath = globFile.split(path.sep).join('/')
    const remoteFilePath = options.destination ? combineURLs(options.destination, normalizedPath) : normalizedPath

    const file: OSSFile = {
      localFilePath,
      remoteFilePath,
      filename,
      mimeType: mimeType || undefined,
      contentType: contentType || undefined,
    }

    if (typeof options.ignoreFiles === 'function') {
      const pass = await options.ignoreFiles(file)

      if (!isNil(pass) && !pass) {
        // ignore this file
        continue
      }
    }

    // Upload the file using the provider's strategy
    await uploader.uploadFile({
      file,
      request,
    })
  }

  console.log('Upload completed successfully')
}
