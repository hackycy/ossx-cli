/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliPath = path.join(projectRoot, 'dist/cli.mjs')

async function runFixture(configSource, options = {}) {
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'ossx-pipeline-test-'))
  const targetDir = path.join(fixtureDir, 'dist')
  const traceFile = path.join(fixtureDir, 'trace.log')
  const configFile = path.join(fixtureDir, 'ossx.config.mjs')
  await mkdir(targetDir)
  await writeFile(path.join(targetDir, 'index.txt'), 'pipeline-test')
  for (const [filename, content] of Object.entries(options.files || {})) {
    const filePath = path.join(targetDir, filename)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
  await writeFile(configFile, configSource({ targetDir, traceFile }))

  const result = await x('node', [cliPath, '--config', configFile], {
    nodeOptions: {
      cwd: projectRoot,
      env: { ...process.env, ...options.env },
    },
    throwOnError: false,
  })
  const trace = await readFile(traceFile, 'utf8').catch(() => '')
  return { fixtureDir, targetDir, trace, result }
}

test('pipeline executes provider profiles strictly in order and removes files after success', async (t) => {
  const { fixtureDir, targetDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile, access } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      removeWhenUploaded: true,
      providers: [
        {
          tag: 'first',
          provider: {
            name: 'custom',
            async upload({ file }) {
              await appendFile(${JSON.stringify(traceFile)}, 'first:start\\n')
              await new Promise(resolve => setTimeout(resolve, 100))
              await access(file.localFilePath)
              await appendFile(${JSON.stringify(traceFile)}, 'first:end\\n')
            },
          },
        },
        {
          tag: 'second',
          provider: {
            name: 'custom',
            async upload({ file }) {
              await access(file.localFilePath)
              await appendFile(${JSON.stringify(traceFile)}, 'second\\n')
            },
          },
        },
      ],
      pipeline: ['first', 'second'],
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 0, result.stderr || result.stdout)
  assert.equal(trace, 'first:start\nfirst:end\nsecond\n')
  await assert.rejects(() => readFile(path.join(targetDir, 'index.txt')))
})

test('pipeline stops after a failed step and preserves source files', async (t) => {
  const { fixtureDir, targetDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      retryTimes: 0,
      removeWhenUploaded: true,
      providers: [
        {
          tag: 'failing',
          provider: {
            name: 'custom',
            async upload() {
              await appendFile(${JSON.stringify(traceFile)}, 'failing\\n')
              throw new Error('expected failure')
            },
          },
        },
        {
          tag: 'never',
          provider: {
            name: 'custom',
            async upload() {
              await appendFile(${JSON.stringify(traceFile)}, 'never\\n')
            },
          },
        },
      ],
      pipeline: ['failing', 'never'],
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 1)
  assert.equal(trace, 'failing\n')
  assert.equal(await readFile(path.join(targetDir, 'index.txt'), 'utf8'), 'pipeline-test')
})

test('pipeline validates every provider tag before uploading', async (t) => {
  const { fixtureDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      providers: [
        {
          tag: 'known',
          provider: {
            name: 'custom',
            async upload() {
              await appendFile(${JSON.stringify(traceFile)}, 'uploaded\\n')
            },
          },
        },
      ],
      pipeline: ['known', 'missing'],
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /unknown provider tag: missing/i)
  assert.equal(trace, '')
})

test('single provider configuration remains compatible', async (t) => {
  const { fixtureDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      provider: {
        name: 'custom',
        async upload() {
          await appendFile(${JSON.stringify(traceFile)}, 'single\\n')
        },
      },
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 0, result.stderr || result.stdout)
  assert.equal(trace, 'single\n')
})

test('OSSX_CI_PROVIDER_TAG still selects one provider when pipeline is omitted', async (t) => {
  const { fixtureDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      providers: [
        {
          tag: 'first',
          provider: { name: 'custom', upload: async () => appendFile(${JSON.stringify(traceFile)}, 'first\\n') },
        },
        {
          tag: 'second',
          provider: { name: 'custom', upload: async () => appendFile(${JSON.stringify(traceFile)}, 'second\\n') },
        },
      ],
    }
  `, { env: { OSSX_CI_PROVIDER_TAG: 'second' } })
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 0, result.stderr || result.stdout)
  assert.equal(trace, 'second\n')
})

test('abortOnFailure stops the remaining files in the current custom task', async (t) => {
  const { fixtureDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      retryTimes: 0,
      abortOnFailure: true,
      provider: {
        name: 'custom',
        async upload() {
          await appendFile(${JSON.stringify(traceFile)}, 'attempt\\n')
          throw new Error('stop now')
        },
      },
    }
  `, { files: { 'second.txt': 'second' } })
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 1)
  assert.equal(trace, 'attempt\n')
})

test('preUpload failure stops the pipeline before later providers', async (t) => {
  const { fixtureDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      providers: [
        {
          tag: 'backup',
          backup: true,
          destination: '/remote',
          provider: {
            name: 'ftp',
            host: '127.0.0.1',
            port: 1,
            username: 'test',
            password: 'test',
            connTimeout: 100,
          },
        },
        {
          tag: 'never',
          provider: { name: 'custom', upload: async () => appendFile(${JSON.stringify(traceFile)}, 'never\\n') },
        },
      ],
      pipeline: ['backup', 'never'],
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 1)
  assert.equal(trace, '')
})

test('worker setup errors become task failures and stop later providers', async (t) => {
  const { fixtureDir, trace, result } = await runFixture(({ targetDir, traceFile }) => `
    import { appendFile } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      providers: [
        {
          tag: 'broken-worker',
          provider: {
            name: 'ssh',
            host: '127.0.0.1',
            unsupportedFunction() {},
          },
        },
        {
          tag: 'never',
          provider: { name: 'custom', upload: async () => appendFile(${JSON.stringify(traceFile)}, 'never\\n') },
        },
      ],
      pipeline: ['broken-worker', 'never'],
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 1)
  assert.equal(trace, '')
})

test('local cleanup failure is reported without changing upload success', async (t) => {
  const { fixtureDir, targetDir, result } = await runFixture(({ targetDir }) => `
    import { mkdir, rm } from 'node:fs/promises'
    export default {
      target: ${JSON.stringify(targetDir)},
      logger: false,
      removeWhenUploaded: true,
      provider: {
        name: 'custom',
        async upload({ file }) {
          await rm(file.localFilePath)
          await mkdir(file.localFilePath)
        },
      },
    }
  `)
  t.after(() => rm(fixtureDir, { recursive: true, force: true }))

  assert.equal(result.exitCode, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /failed to remove local file/i)
  assert.equal((await stat(path.join(targetDir, 'index.txt'))).isDirectory(), true)
})
