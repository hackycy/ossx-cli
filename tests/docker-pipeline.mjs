/* eslint-disable antfu/no-top-level-await */
import assert from 'node:assert/strict'
import { constants } from 'node:fs'
import { access, chmod, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'basic-ftp'
import { NodeSSH } from 'node-ssh'
import { x } from 'tinyexec'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(testsDir, '..')
const composeFile = path.join(testsDir, 'docker-compose.yml')
const runtimeDir = path.join(testsDir, '.docker')
const sourceDir = path.join(runtimeDir, 'source')
const configFile = path.join(runtimeDir, 'ossx.config.mjs')

async function waitForService(connect, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await connect()
      return
    }
    catch {
      // Container may have opened its port while still generating host keys
      // or initializing the user account.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Timed out waiting for Docker test service')
}

async function waitForSsh() {
  return waitForService(async () => {
    const ssh = new NodeSSH()
    try {
      await ssh.connect({ host: '127.0.0.1', port: 2222, username: 'test', password: 'test' })
    }
    finally {
      ssh.dispose()
    }
  })
}

async function waitForFtp() {
  return waitForService(async () => {
    const ftp = new Client(1000)
    try {
      await ftp.access({ host: '127.0.0.1', port: 2121, user: 'test', password: 'test' })
    }
    finally {
      ftp.close()
    }
  })
}

async function compose(...args) {
  return x('docker', ['compose', '--file', composeFile, ...args], {
    nodeOptions: { cwd: testsDir },
  })
}

async function assertFile(relativePath, expected) {
  assert.equal(await readFile(relativePath, 'utf8'), expected)
}

await rm(runtimeDir, { recursive: true, force: true })
await Promise.all([
  mkdir(path.join(runtimeDir, 'sftp'), { recursive: true }),
  mkdir(path.join(runtimeDir, 'ftp'), { recursive: true }),
  mkdir(path.join(sourceDir, 'assets'), { recursive: true }),
])
await Promise.all([
  chmod(path.join(runtimeDir, 'sftp'), 0o777),
  chmod(path.join(runtimeDir, 'ftp'), 0o777),
  writeFile(path.join(sourceDir, 'index.html'), '<h1>ossx pipeline</h1>'),
  writeFile(path.join(sourceDir, 'assets/app.js'), 'console.log("ossx")'),
])

await writeFile(configFile, `
  export default {
    target: ${JSON.stringify(sourceDir)},
    logger: true,
    logDir: ${JSON.stringify(path.join(runtimeDir, 'logs'))},
    retryTimes: 1,
    maxWorkers: 2,
    removeWhenUploaded: true,
    providers: [
      {
        tag: 'ssh',
        destination: '/upload',
        provider: {
          name: 'ssh',
          host: '127.0.0.1',
          port: 2222,
          username: 'test',
          password: 'test',
        },
      },
      {
        tag: 'ftp',
        destination: '/pipeline',
        provider: {
          name: 'ftp',
          host: '127.0.0.1',
          port: 2121,
          username: 'test',
          password: 'test',
        },
      },
    ],
    pipeline: ['ssh', 'ftp'],
  }
`)

try {
  await compose('up', '--detach')
  await Promise.all([waitForSsh(), waitForFtp()])

  const result = await x('node', [path.join(projectRoot, 'dist/cli.mjs'), '--config', configFile], {
    nodeOptions: { cwd: projectRoot },
    throwOnError: false,
  })
  if (result.exitCode !== 0) {
    const logDir = path.join(runtimeDir, 'logs')
    const logs = await readdir(logDir).catch(() => [])
    const logOutput = await Promise.all(logs.map(async file => readFile(path.join(logDir, file), 'utf8')))
    const containerLogs = await compose('logs', '--no-color').catch(() => ({ stdout: '' }))
    assert.equal(result.exitCode, 0, [result.stderr, result.stdout, ...logOutput, containerLogs.stdout].join('\n'))
  }

  const stdout = result.stdout || ''
  assert.ok(stdout.indexOf('Step 1/2: ssh') < stdout.indexOf('Step 2/2: ftp'), stdout)

  await Promise.all([
    assertFile(path.join(runtimeDir, 'sftp/index.html'), '<h1>ossx pipeline</h1>'),
    assertFile(path.join(runtimeDir, 'sftp/assets/app.js'), 'console.log("ossx")'),
    assertFile(path.join(runtimeDir, 'ftp/pipeline/index.html'), '<h1>ossx pipeline</h1>'),
    assertFile(path.join(runtimeDir, 'ftp/pipeline/assets/app.js'), 'console.log("ossx")'),
  ])
  const logFiles = await readdir(path.join(runtimeDir, 'logs'))
  assert.equal(logFiles.length, 1, 'pipeline steps should share one run log')
  const pipelineLog = await readFile(path.join(runtimeDir, 'logs', logFiles[0]), 'utf8')
  assert.match(pipelineLog, /Step ssh/)
  assert.match(pipelineLog, /Step ftp/)
  assert.match(pipelineLog, /password: \[REDACTED\]/)
  assert.doesNotMatch(pipelineLog, /password: test/)
  assert.match(pipelineLog, /OSS Pipeline - Complete/)
  assert.match(pipelineLog, /Steps completed: 2\/2/)
  assert.match(pipelineLog, /Cleanup failures: 0/)
  await assert.rejects(() => access(path.join(sourceDir, 'index.html'), constants.F_OK))
  await assert.rejects(() => access(path.join(sourceDir, 'assets/app.js'), constants.F_OK))
  console.log('Docker pipeline integration test passed: SSH -> FTP')
}
finally {
  await compose('down', '--volumes', '--remove-orphans').catch(() => undefined)
  await rm(runtimeDir, { recursive: true, force: true })
}
