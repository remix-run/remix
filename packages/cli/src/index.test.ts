import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'

describe('cli entrypoint', () => {
  it('runs directly from the source entrypoint', () => {
    let packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    let result = spawnSync(process.execPath, ['./src/index.ts', '--help'], {
      cwd: packageDir,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('injects the repo Remix version when running directly from the source entrypoint', () => {
    let packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    let remixPackageJsonPath = resolve(packageDir, '../remix/package.json')
    let remixPackageJson = JSON.parse(fs.readFileSync(remixPackageJsonPath, 'utf8')) as {
      version: string
    }
    let result = spawnSync(process.execPath, ['./src/index.ts', 'version'], {
      cwd: packageDir,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${remixPackageJson.version}\n`)
    assert.equal(result.stderr, '')
  })
})
