import type { OssOptions } from './types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { glob } from 'tinyglobby'
import { createUploader } from './providers'

export async function uploadOSS(options: OssOptions): Promise<void> {
  // Validate options
  if (!options.provider) {
    throw new Error('Provider is required')
  }

  if (!options.target) {
    throw new Error('Target directory is required')
  }

  if (!options.destination) {
    throw new Error('Destination path is required')
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
  const ignorePatterns = options.ignoreFiles || []

  // Get all files in the target directory
  const files = await glob(patterns, {
    cwd: targetDir,
    ignore: ignorePatterns,
    dot: true,
    absolute: false,
  })

  console.log(`Found ${files.length} files to upload`)

  // Upload each file
  for (const file of files) {
    // Skip directories
    const localFilePath = path.join(targetDir, file)
    const stat = fs.statSync(localFilePath)
    if (stat.isDirectory()) {
      continue
    }

    // Calculate the remote path - OSS always uses forward slashes (/) regardless of OS
    // Normalize the path to ensure consistent handling across platforms
    const normalizedPath = file.split(path.sep).join('/')
    const remoteFilePath = options.destination.endsWith('/')
      ? `${options.destination}${normalizedPath}`
      : `${options.destination}/${normalizedPath}`

    // Upload the file using the provider's strategy
    await uploader.uploadFile(localFilePath, remoteFilePath, options)
  }

  console.log('Upload completed successfully')
}
