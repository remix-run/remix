import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { run } from '../index.ts'

describe('run', () => {
  it('prints root help', async () => {
    let result = await captureOutput(() => run(['--help']))

    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
    assert.match(result.stdout, /skills\s+Manage Remix skills/)
    assert.equal(result.stderr, '')
  })

  it('prints the configured version', async () => {
    let result = await withEnv('REMIX_CLI_VERSION', '9.9.9', () =>
      captureOutput(() => run(['--version'])),
    )

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, '9.9.9\n')
    assert.equal(result.stderr, '')
  })

  it('prints new command help', async () => {
    let result = await captureOutput(() => run(['new', '--help']))

    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /Usage:\s+remix new <target-dir>/)
    assert.equal(result.stderr, '')
  })

  it('ignores a leading double-dash separator', async () => {
    let result = await captureOutput(() => run(['--', '--help']))

    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
    assert.equal(result.stderr, '')
  })

  it('fails for unknown commands', async () => {
    let result = await captureOutput(() => run(['unknown']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Unknown command: unknown/)
    assert.match(result.stderr, /Usage:\s+remix <command> \[options\]/)
  })

  it('creates the expected scaffold', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      let result = await captureOutput(() => run(['new', appDir, '--app-name', 'My App']))

      assert.equal(result.exitCode, 0)
      assert.match(result.stdout, new RegExp(`Created My App at ${escapeRegExp(appDir)}`))

      let packageJson = JSON.parse(
        await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      let agentsGuide = await fs.readFile(path.join(appDir, 'AGENTS.md'), 'utf8')
      let readme = await fs.readFile(path.join(appDir, 'README.md'), 'utf8')

      assert.equal(packageJson.name, 'my-app')
      assert.equal(packageJson.dependencies.remix, 'latest')
      assert.equal(packageJson.dependencies.tsx, 'latest')
      assert.equal(packageJson.devDependencies['@types/node'], 'latest')
      assert.equal(packageJson.devDependencies.typescript, 'latest')
      assert.match(agentsGuide, /^# My App Agent Guide/m)
      assert.match(agentsGuide, /This starter intentionally begins small/)
      assert.match(agentsGuide, /Keep simple pages in flat files like `app\/controllers\/home\.tsx`/)
      assert.match(readme, /^# My App/m)
      await assertPathExists(path.join(appDir, 'app', 'routes.ts'))
      await assertPathExists(path.join(appDir, 'app', 'controllers', 'home.tsx'))
      await assertPathExists(path.join(appDir, 'app', 'controllers', 'auth.tsx'))
      await assertPathMissing(path.join(appDir, 'app', 'controllers', 'about.tsx'))
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rejects non-empty target directories without --force', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      await fs.mkdir(appDir, { recursive: true })
      await fs.writeFile(path.join(appDir, 'keep.txt'), 'keep', 'utf8')

      let result = await captureOutput(() => run(['new', appDir]))

      assert.equal(result.exitCode, 1)
      assert.match(
        result.stderr,
        new RegExp(`Target directory is not empty: ${escapeRegExp(appDir)}`),
      )
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('uses the override version when remix version is omitted', async () => {
    let tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-cli-'))
    try {
      let appDir = path.join(tmpDir, 'my-app')
      let result = await withEnv('REMIX_VERSION', '4.5.6', () =>
        captureOutput(() => run(['new', appDir])),
      )

      assert.equal(result.exitCode, 0)

      let packageJson = JSON.parse(
        await fs.readFile(path.join(appDir, 'package.json'), 'utf8'),
      ) as {
        dependencies: Record<string, string>
      }

      assert.equal(packageJson.dependencies.remix, '4.5.6')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('rejects the removed remix version flag', async () => {
    let result = await captureOutput(() => run(['new', 'my-app', '--remix-version', '1.2.3']))

    assert.equal(result.exitCode, 1)
    assert.match(result.stderr, /Unknown argument: --remix-version/)
  })
})

async function captureOutput(
  callback: () => Promise<number>,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let stderr = ''
  let stdout = ''
  let originalStdoutWrite = process.stdout.write
  let originalStderrWrite = process.stderr.write

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    let exitCode = await callback()
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  }
}

async function withEnv<T>(
  name: string,
  value: string,
  callback: () => Promise<T>,
): Promise<T> {
  let previousValue = process.env[name]
  process.env[name] = value

  try {
    return await callback()
  } finally {
    if (previousValue == null) {
      delete process.env[name]
    } else {
      process.env[name] = previousValue
    }
  }
}

async function assertPathExists(filePath: string): Promise<void> {
  await fs.access(filePath)
}

async function assertPathMissing(filePath: string): Promise<void> {
  await assert.rejects(fs.access(filePath), (error: unknown) => {
    let nodeError = error as NodeJS.ErrnoException
    return nodeError.code === 'ENOENT'
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}
