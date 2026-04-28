import * as assert from '@remix-run/assert'
import * as fs from 'node:fs'
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
  scripts: {
    cli?: string
  }
}

interface RemixPackageJson extends PackageJsonWithEngines {
  bin?: Record<string, string>
  exports: {
    './cli'?: string
  }
}

describe('cli entrypoint', () => {
  it('only exposes the remix bin from the generated remix package', () => {
    let remixPackageJson = readRemixPackageJson()

    assert.deepEqual(remixPackageJson.bin, {
      remix: './src/cli-entry.ts',
    })
  })

  it('does not provide a direct @remix-run/cli executable', () => {
    let cliPackageJson = readCliPackageJson()

    assert.equal(cliPackageJson.bin, undefined)
    assert.equal(cliPackageJson.publishConfig.bin, undefined)
    assert.equal(cliPackageJson.scripts.cli, undefined)
    assert.equal(fs.existsSync(resolve(PACKAGE_DIR, 'src', 'cli.ts')), false)
  })

  it('declares the Node.js floor for published CLI entrypoints', () => {
    assert.equal(readCliPackageJson().engines.node, '>=24.3.0')
    assert.equal(readRemixPackageJson().engines.node, '>=24.3.0')
    assert.equal(readTestPackageJson().engines.node, '>=24.3.0')
  })

  it('exposes remix/cli from the generated remix package', () => {
    let remixPackageJson = readRemixPackageJson()

    assert.equal(remixPackageJson.exports['./cli'], './src/cli.ts')
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
