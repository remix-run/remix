import * as assert from '@remix-run/assert'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it } from '@remix-run/test'

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REMIX_PACKAGE_DIR = resolve(PACKAGE_DIR, '../remix')
const TEST_PACKAGE_DIR = resolve(PACKAGE_DIR, '../test')

interface PackageJsonWithEngines {
  engines: {
    node: string
  }
}

interface CliPackageJson extends PackageJsonWithEngines {
  bin?: Record<string, string>
  publishConfig: {
    bin?: Record<string, string>
  }
}

interface RemixPackageJson extends PackageJsonWithEngines {
  bin?: Record<string, string>
  version: string
}

describe('cli entrypoint', () => {
  it('runs directly from the source entrypoint', () => {
    let result = spawnSync(process.execPath, ['./src/cli.ts', '--help'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('runs through the generated remix package wrapper', () => {
    let result = spawnSync(process.execPath, ['./src/cli-entry.ts', '--help'], {
      cwd: REMIX_PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:\s+remix <command> \[options\]/)
  })

  it('only exposes the remix bin from the generated remix package', () => {
    let remixPackageJson = readRemixPackageJson()

    assert.deepEqual(remixPackageJson.bin, {
      remix: './src/cli-entry.ts',
    })
  })

  it('does not publish a direct @remix-run/cli bin', () => {
    let cliPackageJson = readCliPackageJson()

    assert.equal(cliPackageJson.bin, undefined)
    assert.equal(cliPackageJson.publishConfig.bin, undefined)
  })

  it('declares the Node.js floor for published CLI entrypoints', () => {
    assert.equal(readCliPackageJson().engines.node, '>=24.3.0')
    assert.equal(readRemixPackageJson().engines.node, '>=24.3.0')
    assert.equal(readTestPackageJson().engines.node, '>=24.3.0')
  })

  it('generates remix/cli as a regular package re-export', () => {
    let source = fs.readFileSync(resolve(REMIX_PACKAGE_DIR, 'src', 'cli.ts'), 'utf8')

    assert.equal(
      source,
      [
        '// IMPORTANT: This file is auto-generated, please do not edit manually.',
        "export * from '@remix-run/cli'",
        '',
      ].join('\n'),
    )
  })

  it('injects the repo Remix version when running directly from the source entrypoint', () => {
    let remixPackageJson = readRemixPackageJson()
    let result = spawnSync(process.execPath, ['./src/cli.ts', 'version'], {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${remixPackageJson.version}\n`)
    assert.equal(result.stderr, '')
  })

  it('injects the repo Remix version when running through the generated remix package wrapper', () => {
    let remixPackageJson = readRemixPackageJson()
    let result = spawnSync(process.execPath, ['./src/cli-entry.ts', 'version'], {
      cwd: REMIX_PACKAGE_DIR,
      encoding: 'utf8',
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, `${remixPackageJson.version}\n`)
    assert.equal(result.stderr, '')
  })
})

function readRemixPackageJson(): RemixPackageJson {
  return JSON.parse(
    fs.readFileSync(resolve(REMIX_PACKAGE_DIR, 'package.json'), 'utf8'),
  ) as RemixPackageJson
}

function readCliPackageJson(): CliPackageJson {
  return JSON.parse(
    fs.readFileSync(resolve(PACKAGE_DIR, 'package.json'), 'utf8'),
  ) as CliPackageJson
}

function readTestPackageJson(): PackageJsonWithEngines {
  return JSON.parse(
    fs.readFileSync(resolve(TEST_PACKAGE_DIR, 'package.json'), 'utf8'),
  ) as PackageJsonWithEngines
}
