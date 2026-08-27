import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { captureOutput } from '../../../test/capture-output.ts'
import { runRemix } from '../../index.ts'

describe('assets command', () => {
  it('prints command help', async () => {
    let result = await captureOutput(() => runRemix(['assets', '--help']))

    assert.equal(result.exitCode, 0, result.stderr)
    assert.match(result.stdout, /remix assets inspect <url-or-file>/)
    assert.match(result.stdout, /List or inspect browser-reachable assets\./)
    assert.equal(result.stderr, '')
  })

  it('lists reachable assets one per line from a nested project directory', async () => {
    let projectDir = await createAssetsProject()

    try {
      let result = await runAssets([], path.join(projectDir, 'app', 'public'))

      assert.equal(result.exitCode, 0, result.stderr)
      assert.match(result.stdout, /^\/assets\/app\/public\/entry\.ts -> app\/public\/entry\.ts$/m)
      assert.match(result.stdout, /^\/assets\/app\/public\/logo\.svg -> app\/public\/logo\.svg$/m)
      assert.doesNotMatch(result.stdout, /entry\.test\.ts/)
      assert.doesNotMatch(result.stdout, /private\/secret\.ts/)
      assert.ok(!result.stdout.startsWith('\n'))
      assert.ok(!result.stdout.includes('\n\n'))
      assert.ok(result.stdout.endsWith('\n'))
      assert.equal(result.stderr, '')
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('shows details for an asset URL or file path', async () => {
    let projectDir = await createAssetsProject()

    try {
      let byUrl = await runAssets(['inspect', '/assets/app/public/entry.ts'], projectDir)
      assert.equal(byUrl.exitCode, 0, byUrl.stderr)
      assert.equal(
        byUrl.stdout,
        [
          'Status: reachable',
          'URL: /assets/app/public/entry.ts',
          'File: app/public/entry.ts',
          '',
        ].join('\n'),
      )

      let byAbsoluteUrl = await runAssets(
        ['inspect', 'https://example.com/assets/app/public/entry.ts'],
        projectDir,
      )
      assert.equal(byAbsoluteUrl.exitCode, 0, byAbsoluteUrl.stderr)
      assert.equal(byAbsoluteUrl.stdout, byUrl.stdout)

      let byFile = await runAssets(['inspect', 'app/public/logo.svg'], projectDir)
      assert.equal(byFile.exitCode, 0, byFile.stderr)
      assert.equal(
        byFile.stdout,
        [
          'Status: reachable',
          'URL: /assets/app/public/logo.svg',
          'File: app/public/logo.svg',
          '',
        ].join('\n'),
      )

      let denied = await runAssets(['inspect', '/assets/app/public/entry.test.ts'], projectDir)
      assert.equal(denied.exitCode, 0, denied.stderr)
      assert.equal(
        denied.stdout,
        [
          'Status: denied',
          'URL: /assets/app/public/entry.test.ts',
          'File: app/public/entry.test.ts',
          'Denied by: app/**/*.test.*',
          '',
        ].join('\n'),
      )
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })

  it('requires the inspect subcommand and an asset URL or file path', async () => {
    let direct = await runAssets(['/assets/app/public/entry.ts'], process.cwd())
    let missing = await runAssets(['inspect'], process.cwd())

    assert.equal(direct.exitCode, 1)
    assert.match(direct.stderr, /Unknown command: assets \/assets\/app\/public\/entry\.ts/)
    assert.equal(missing.exitCode, 1)
    assert.match(missing.stderr, /`remix assets inspect` requires a URL or file path\./)
  })

  it('reports a missing assets configuration', async () => {
    let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-assets-command-missing-'))

    try {
      await fs.writeFile(path.join(projectDir, 'remix.json'), '{}')
      let result = await runAssets([], projectDir)

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Asset configuration is required/)
      assert.match(result.stderr, /Add an assets configuration to remix\.json\./)
    } finally {
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  })
})

async function createAssetsProject(): Promise<string> {
  let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-assets-command-'))
  await write(projectDir, 'app/public/entry.ts', 'export const value = 1')
  await write(projectDir, 'app/public/entry.test.ts', 'export const test = true')
  await write(projectDir, 'app/public/logo.svg', '<svg />')
  await write(projectDir, 'app/private/secret.ts', 'export const secret = true')
  await fs.writeFile(
    path.join(projectDir, 'remix.json'),
    JSON.stringify({
      assets: {
        allowFiles: ['app/public/**'],
        basePath: '/assets',
        denyFiles: ['app/**/*.test.*'],
        fileMap: { '/app/*path': 'app/*path' },
        files: { extensions: ['.svg'] },
      },
    }),
  )
  return projectDir
}

async function write(rootDir: string, relativePath: string, content: string): Promise<void> {
  let filePath = path.join(rootDir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content)
}

function runAssets(args: string[], cwd: string) {
  return captureOutput(() => runRemix(['assets', ...args], { cwd }))
}
