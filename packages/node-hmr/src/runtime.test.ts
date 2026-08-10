import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type * as DefaultRuntime from './runtime.ts'
import type * as NodeRuntime from './runtime.node-hmr.ts'

type Assert<condition extends true> = condition
type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? (<value>() => value extends right ? 1 : 2) extends <value>() => value extends left ? 1 : 2
      ? true
      : false
    : false

type RuntimeExportKeysMatch = Assert<Equal<keyof typeof DefaultRuntime, keyof typeof NodeRuntime>>
type DefaultRuntimeAssignableToNodeRuntime = Assert<
  [typeof DefaultRuntime] extends [typeof NodeRuntime] ? true : false
>
type NodeRuntimeAssignableToDefaultRuntime = Assert<
  [typeof NodeRuntime] extends [typeof DefaultRuntime] ? true : false
>
type RuntimeBrowserHmrChannelTypeMatches = Assert<
  Equal<DefaultRuntime.BrowserHmrChannel, NodeRuntime.BrowserHmrChannel>
>

void (undefined as unknown as RuntimeExportKeysMatch)
void (undefined as unknown as DefaultRuntimeAssignableToNodeRuntime)
void (undefined as unknown as NodeRuntimeAssignableToDefaultRuntime)
void (undefined as unknown as RuntimeBrowserHmrChannelTypeMatches)

describe('runtime', () => {
  it('lists the node-hmr runtime condition before the default runtime export', async () => {
    let packageJson = await readPackageJson()
    let runtimeExport = getRuntimeExportConfig(packageJson.exports)

    assert.deepEqual(Object.keys(runtimeExport), ['node-hmr', 'default'])
  })

  it('lists the published node-hmr runtime condition before other runtime conditions', async () => {
    let packageJson = await readPackageJson()
    let runtimeExport = getRuntimeExportConfig(packageJson.publishConfig?.exports)

    assert.deepEqual(Object.keys(runtimeExport), ['node-hmr', 'types', 'default'])
  })

  it('throws when the default runtime module is imported outside node-hmr', async () => {
    await assert.rejects(
      () => import(`./runtime.ts?test=${Date.now()}`),
      /The node-hmr\/runtime API is only available when running inside node-hmr/,
    )
  })

  it('throws when the node-hmr runtime module is imported without an installed runtime', async () => {
    await assert.rejects(
      () => import(`./runtime.node-hmr.ts?test=${Date.now()}`),
      /The node-hmr\/runtime API is only available when running inside node-hmr/,
    )
  })
})

interface PackageJson {
  exports?: unknown
  publishConfig?: {
    exports?: unknown
  }
}

async function readPackageJson(): Promise<PackageJson> {
  let packageJsonPath = path.resolve(import.meta.dirname, '../package.json')
  let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as unknown
  if (!isPackageJson(packageJson)) {
    throw new TypeError('Expected package.json to contain an object')
  }

  return packageJson
}

function getRuntimeExportConfig(exportsConfig: unknown): Record<string, unknown> {
  if (!isRecord(exportsConfig)) {
    throw new TypeError('Expected package.json exports to contain an object')
  }

  let runtimeExport = exportsConfig['./runtime']
  if (!isRecord(runtimeExport)) {
    throw new TypeError('Expected package.json exports["./runtime"] to contain an object')
  }

  return runtimeExport
}

function isPackageJson(value: unknown): value is PackageJson {
  return isRecord(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
