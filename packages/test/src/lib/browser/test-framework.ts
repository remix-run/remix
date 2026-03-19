import { createRoot } from '@remix-run/component'
import type { RemixNode } from '@remix-run/component/jsx-runtime'

interface TestSuite {
  name: string
  tests: Test[]
  beforeEach?: () => void | Promise<void>
  afterEach?: () => void | Promise<void>
  beforeAll?: () => void | Promise<void>
  afterAll?: () => void | Promise<void>
}

interface Test {
  name: string
  fn: () => void | Promise<void>
  suite: TestSuite
}

let currentSuite: TestSuite | null = null
let rootSuites: TestSuite[] = []

// Expose for test-executor.ts which reads this global
;(globalThis as any).__testSuites = rootSuites

export function describe(name: string, fn: () => void) {
  let parentSuite = currentSuite
  let suite: TestSuite = { name, tests: [] }

  if (parentSuite) {
    throw new Error('Nested describe() not supported')
  }

  rootSuites.push(suite)
  currentSuite = suite
  fn()
  currentSuite = parentSuite
}

export function it(name: string, fn: () => void | Promise<void>) {
  if (!currentSuite) throw new Error('it() must be called inside describe()')
  currentSuite.tests.push({ name, fn, suite: currentSuite })
}

export function beforeEach(fn: () => void | Promise<void>) {
  if (!currentSuite) throw new Error('beforeEach() must be called inside describe()')
  currentSuite.beforeEach = fn
}

export function afterEach(fn: () => void | Promise<void>) {
  if (!currentSuite) throw new Error('afterEach() must be called inside describe()')
  currentSuite.afterEach = fn
}

export function beforeAll(fn: () => void | Promise<void>) {
  if (!currentSuite) throw new Error('beforeAll() must be called inside describe()')
  currentSuite.beforeAll = fn
}

export function afterAll(fn: () => void | Promise<void>) {
  if (!currentSuite) throw new Error('afterAll() must be called inside describe()')
  currentSuite.afterAll = fn
}

export function resetTestFramework() {
  rootSuites.length = 0
  currentSuite = null
}

export function render(node: RemixNode) {
  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  return {
    container,
    root,
    $: (s: string) => container.querySelector<HTMLElement>(s),
    $$: (s: string) => container.querySelectorAll<HTMLElement>(s),
    async act(fn: () => unknown | Promise<unknown>) {
      await fn()
      root.flush()
    },
    cleanup() {
      root.dispose()
      container.remove()
    },
  }
}
