import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REMIX_PACKAGE_DIR = resolve(PACKAGE_DIR, '../remix')

describe('cli entrypoint', () => {
  it('runs directly from the source entrypoint', () => {
    let result = spawnSync(process.execPath, ['./src/index.ts', '--help'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('runs through the generated remix package wrapper', () => {
    let result = spawnSync(process.execPath, ['./src/cli.ts', '--help'], {
      cwd: REMIX_PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('injects the repo Remix version when running directly from the source entrypoint', () => {
    let remixPackageJson = readRemixPackageJson()
    let result = spawnSync(process.execPath, ['./src/index.ts', 'version'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${remixPackageJson.version}\n`)
    assert.equal(result.stderr, '')
  })

  it('injects the repo Remix version when running through the generated remix package wrapper', () => {
    let remixPackageJson = readRemixPackageJson()
    let result = spawnSync(process.execPath, ['./src/cli.ts', 'version'], {
      cwd: REMIX_PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${remixPackageJson.version}\n`)
    assert.equal(result.stderr, '')
  })
})

function readRemixPackageJson(): { version: string } {
  return JSON.parse(fs.readFileSync(resolve(REMIX_PACKAGE_DIR, 'package.json'), 'utf8')) as {
    version: string
  }
}
