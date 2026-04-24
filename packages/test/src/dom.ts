import * as framework from './lib/framework.ts'
import type { DomTestContext } from './lib/context-dom.ts'

export type { RemixTestConfig } from './lib/config.ts'
export type { FakeTimers } from './lib/fake-timers.ts'
export type { DomTestContext as TestContext, RenderResult } from './lib/context-dom.ts'
export { mock } from './lib/mock.ts'
export { describe, suite, before, after, beforeEach, afterEach, beforeAll, afterAll } from './lib/framework.ts'

type TestMeta = { skip?: boolean; only?: boolean }
type TestFn = (t: DomTestContext) => void | Promise<void>

interface It {
  (name: string, fn: TestFn): void
  (name: string, meta: TestMeta, fn: TestFn): void
  skip: (name: string, fn?: TestFn) => void
  only: (name: string, fn: TestFn) => void
  todo: (name: string) => void
}

export const it = framework.it as unknown as It
export const test = framework.test as unknown as It
