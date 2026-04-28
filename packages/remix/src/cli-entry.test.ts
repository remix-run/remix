import * as assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as process from 'node:process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('cli entrypoint', () => {
  it('runs through the generated remix package wrapper', () => {
    let result = spawnSync(process.execPath, ['./src/cli-entry.ts', '--help'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('injects the repo Remix version when running through the generated remix package wrapper', () => {
    let remixPackageJson = readPackageJson()
    let result = spawnSync(process.execPath, ['./src/cli-entry.ts', 'version'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${remixPackageJson.version}\n`)
    assert.equal(result.stderr, '')
  })
})

function readPackageJson(): { version: string } {
  return JSON.parse(fs.readFileSync(resolve(PACKAGE_DIR, 'package.json'), 'utf8')) as {
    version: string
  }
}
