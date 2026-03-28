import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { run as runCli } from '@remix-run/cli'

import { run } from '../index.ts'

describe('create-remix', () => {
  it('prints the remix new help when no args are provided', async () => {
    let createRemixResult = await captureOutput(() => run([]))
    let cliResult = await captureOutput(() => runCli(['new']))

    assert.deepEqual(createRemixResult, cliResult)
  })

  it('prints the remix new help for --help', async () => {
    let createRemixResult = await captureOutput(() => run(['--help']))
    let cliResult = await captureOutput(() => runCli(['new', '--help']))

    assert.deepEqual(createRemixResult, cliResult)
  })

  it('forwards unknown flags to remix new', async () => {
    let createRemixResult = await captureOutput(() => run(['my-app', '--not-a-real-flag']))
    let cliResult = await captureOutput(() => runCli(['new', 'my-app', '--not-a-real-flag']))

    assert.deepEqual(createRemixResult, cliResult)
  })

  it('forwards the target directory and app name when scaffolding', async () => {
    let createRemixRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-remix-'))
    let cliRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-remix-cli-'))

    try {
      let createRemixDir = path.join(createRemixRoot, 'my-app')
      let cliDir = path.join(cliRoot, 'my-app')

      let createRemixResult = await captureOutput(() =>
        run([createRemixDir, '--app-name', 'My App']),
      )
      let cliResult = await captureOutput(() => runCli(['new', cliDir, '--app-name', 'My App']))

      assert.equal(createRemixResult.exitCode, 0)
      assert.equal(cliResult.exitCode, 0)
      assert.equal(createRemixResult.stderr, cliResult.stderr)
      await assertExpectedScaffold(createRemixDir)
      await assertMatchingScaffolds(createRemixDir, cliDir)
    } finally {
      await fs.rm(createRemixRoot, { recursive: true, force: true })
      await fs.rm(cliRoot, { recursive: true, force: true })
    }
  })

  it('forwards --force when scaffolding into a non-empty directory', async () => {
    let createRemixRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-remix-force-'))
    let cliRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-remix-cli-force-'))

    try {
      let createRemixDir = path.join(createRemixRoot, 'my-app')
      let cliDir = path.join(cliRoot, 'my-app')

      await fs.mkdir(createRemixDir, { recursive: true })
      await fs.mkdir(cliDir, { recursive: true })
      await fs.writeFile(path.join(createRemixDir, 'keep.txt'), 'keep\n', 'utf8')
      await fs.writeFile(path.join(cliDir, 'keep.txt'), 'keep\n', 'utf8')

      let createRemixResult = await captureOutput(() => run([createRemixDir, '--force']))
      let cliResult = await captureOutput(() => runCli(['new', cliDir, '--force']))

      assert.equal(createRemixResult.exitCode, 0)
      assert.equal(cliResult.exitCode, 0)
      assert.equal(createRemixResult.stderr, cliResult.stderr)
      await assertExpectedScaffold(createRemixDir)
      await assertMatchingScaffolds(createRemixDir, cliDir)
      assert.equal(await fs.readFile(path.join(createRemixDir, 'keep.txt'), 'utf8'), 'keep\n')
    } finally {
      await fs.rm(createRemixRoot, { recursive: true, force: true })
      await fs.rm(cliRoot, { recursive: true, force: true })
    }
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

async function assertExpectedScaffold(targetDir: string): Promise<void> {
  let packageJson = JSON.parse(await fs.readFile(path.join(targetDir, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    engines: Record<string, string>
    name: string
  }
  let agentsGuide = await fs.readFile(path.join(targetDir, 'AGENTS.md'), 'utf8')
  let readme = await fs.readFile(path.join(targetDir, 'README.md'), 'utf8')

  assert.equal(packageJson.name, 'my-app')
  assert.equal(packageJson.dependencies.remix, 'latest')
  assert.equal(packageJson.dependencies.tsx, 'latest')
  assert.equal(packageJson.devDependencies['@types/node'], 'latest')
  assert.equal(packageJson.devDependencies.typescript, 'latest')
  assert.equal(packageJson.engines.node, '>=24.3.0')
  assert.match(agentsGuide, /^# My App Agent Guide/m)
  assert.match(agentsGuide, /This starter intentionally begins small/)
  assert.match(agentsGuide, /Keep simple pages in flat files like `app\/controllers\/home\.tsx`/)
  assert.match(readme, /^# My App/m)
  await assertPathExists(path.join(targetDir, 'app', 'routes.ts'))
  await assertPathExists(path.join(targetDir, 'app', 'controllers', 'home.tsx'))
  await assertPathExists(path.join(targetDir, 'app', 'controllers', 'auth.tsx'))
  await assertPathMissing(path.join(targetDir, 'app', 'controllers', 'about.tsx'))
}

async function assertMatchingScaffolds(leftDir: string, rightDir: string): Promise<void> {
  let leftPackageJson = JSON.parse(
    await fs.readFile(path.join(leftDir, 'package.json'), 'utf8'),
  ) as Record<string, unknown>
  let rightPackageJson = JSON.parse(
    await fs.readFile(path.join(rightDir, 'package.json'), 'utf8'),
  ) as Record<string, unknown>

  assert.deepEqual(leftPackageJson, rightPackageJson)
  assert.equal(
    await fs.readFile(path.join(leftDir, 'AGENTS.md'), 'utf8'),
    await fs.readFile(path.join(rightDir, 'AGENTS.md'), 'utf8'),
  )
  assert.equal(
    await fs.readFile(path.join(leftDir, 'README.md'), 'utf8'),
    await fs.readFile(path.join(rightDir, 'README.md'), 'utf8'),
  )
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
