import * as remixAssert from '@remix-run/assert'
import { describe as suite, it as test } from '@remix-run/test'

import { importShim as importShimImplementation } from '../src/lib/core.ts'

interface TestLoad {
  b: string
}

interface TestRuntime {
  registry: Record<string, TestLoad>
}

// Upstream tests intentionally access arbitrary exports from many fixture module shapes.
type TestModule = Record<string, any>
type Assert = typeof remixAssert & ((value: unknown, message?: string) => void)

const assert: Assert = Object.assign(function assert(value: unknown, message?: string): void {
  remixAssert.ok(value, message)
}, remixAssert)

const importShim = importShimImplementation as (id: string) => Promise<TestModule>

function fail(message?: string): never {
  remixAssert.fail(message)
}

function getLoad(url: string): TestLoad | undefined {
  let runtimeSymbol = Object.getOwnPropertySymbols(globalThis).find((symbol) =>
    symbol.description?.startsWith('remix.importMapPolyfill.runtime:'),
  )
  if (!runtimeSymbol) return undefined
  return (globalThis as typeof globalThis & Record<symbol, TestRuntime>)[runtimeSymbol].registry[
    url
  ]
}

export { assert, fail, getLoad, importShim, suite, test }
