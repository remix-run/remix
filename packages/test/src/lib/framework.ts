import type { TestContext } from './context.ts'

interface TestSuite {
  name: string
  tests: Test[]
  only?: boolean
  skip?: boolean
  todo?: boolean
  beforeEach?: () => void | Promise<void>
  afterEach?: () => void | Promise<void>
  beforeAll?: () => void | Promise<void>
  afterAll?: () => void | Promise<void>
}

interface Test {
  name: string
  fn: (t?: any) => void | Promise<void>
  suite: TestSuite
  only?: boolean
  skip?: boolean
  todo?: boolean
}

// Holds lifecycle hooks registered at the top level (outside any describe).
// Top-level describes inherit these hooks just like nested describes inherit
// from their parent.
const rootHooks: Pick<TestSuite, 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll'> = {}

let currentSuite: TestSuite | null = null
const rootSuites: TestSuite[] = []

// Lazily-created suite for top-level it() calls outside any describe().
// Name '' causes the reporter to display these tests under "Global".
// We check rootSuites.includes() so the suite is re-created after the executor
// clears rootSuites between files (suites.length = 0) or after captureRegistration splices it.
let implicitRootSuite: TestSuite | null = null
function getImplicitRootSuite(): TestSuite {
  if (!implicitRootSuite || !rootSuites.includes(implicitRootSuite)) {
    implicitRootSuite = { name: '', tests: [], ...rootHooks }
    rootSuites.push(implicitRootSuite)
  }
  return implicitRootSuite
}

// Expose for executor.ts which reads this global
;(globalThis as any).__testSuites = rootSuites

function registerDescribe(
  name: string,
  fn: () => void,
  flags?: { only?: boolean; skip?: boolean },
) {
  // Nested describes are flattened: "Parent > Child"
  let fullName = currentSuite ? `${currentSuite.name} > ${name}` : name
  if (rootSuites.some((s) => s.name === fullName)) {
    throw new Error(`Duplicate suite name: "${fullName}"`)
  }
  let suite: TestSuite = { name: fullName, tests: [], ...flags }

  // Inherit lifecycle hooks from parent suite (or root hooks if at top level)
  let parent = currentSuite ?? rootHooks
  if (parent.beforeEach) suite.beforeEach = parent.beforeEach
  if (parent.afterEach) suite.afterEach = parent.afterEach
  if (parent.beforeAll) suite.beforeAll = parent.beforeAll
  if (parent.afterAll) suite.afterAll = parent.afterAll

  let insertedAt = rootSuites.length
  rootSuites.push(suite)
  let prevSuite = currentSuite
  currentSuite = suite
  try {
    fn()
  } catch (error) {
    // Remove this suite and any suites registered during fn() so they don't
    // end up in the executor after a failed registration call
    rootSuites.splice(insertedAt)
    throw error
  } finally {
    currentSuite = prevSuite
  }
}

// We implement this standalone so we can leverage multiple signatures through
// typedoc, but we need to do the `const describe = Object.assign()` thing below to
// get the modifiers onto the method in a typescript-aware way.
function describeImpl(name: string, fn: () => void): void
function describeImpl(name: string, meta: SuiteMeta, fn: () => void): void
function describeImpl(name: string, metaOrFn: SuiteMeta | (() => void), fn?: () => void): void {
  let meta = typeof metaOrFn === 'function' ? {} : metaOrFn
  let suiteFn = typeof metaOrFn === 'function' ? metaOrFn : fn!
  registerDescribe(name, suiteFn, meta)
}

/**
 * Groups related tests into a named suite. Suites can be nested and will be displayed
 * as such in reporter output. Lifecycle hooks registered inside
 * a `describe` block apply only to tests within that block.
 *
 * @example
 * describe('auth', () => {
 *   it('logs in', async () => { ... })
 * })
 *
 * // Modifiers
 * describe.skip('skipped suite', () => { ... })
 * describe.only('focused suite', () => { ... })
 * describe.todo('planned suite')
 *
 * @param name - The suite name shown in reporter output.
 * @param meta - Suite metadata such as `skip` or `only`.
 * @param fn - A function that registers the tests and lifecycle hooks in this suite.
 */
export const describe = Object.assign(describeImpl, {
  skip: (name: string, fn: () => void) => registerDescribe(name, fn, { skip: true }),
  only: (name: string, fn: () => void) => registerDescribe(name, fn, { only: true }),
  todo: (name: string) => {
    let fullName = currentSuite ? `${currentSuite.name} > ${name}` : name
    if (rootSuites.some((s) => s.name === fullName)) {
      throw new Error(`Duplicate suite name: "${fullName}"`)
    }
    rootSuites.push({ name: fullName, tests: [], todo: true })
  },
})

type SuiteMeta = { skip?: boolean; only?: boolean }
type TestMeta = { skip?: boolean; only?: boolean }
type TestFn = (t: TestContext) => void | Promise<void>

function registerIt(name: string, fn: TestFn, flags?: { only?: boolean; skip?: boolean }) {
  let suite = currentSuite ?? getImplicitRootSuite()
  if (suite.tests.some((t) => t.name === name)) {
    throw new Error(`Duplicate test name: "${name}" in suite "${suite.name || 'Global'}"`)
  }
  suite.tests.push({ name, fn, suite, ...flags })
}

// We implement this standalone so we can leverage multiple signatures through
// typedoc, but we need to do the `const it = Object.assign()` thing below to
// get the modifiers onto the method in a typescript-aware way.
function itImpl(name: string, fn: TestFn): void
function itImpl(name: string, meta: TestMeta, fn: TestFn): void
function itImpl(name: string, metaOrFn: TestMeta | TestFn, fn?: TestFn): void {
  let meta = typeof metaOrFn === 'function' ? {} : metaOrFn
  let testFn = typeof metaOrFn === 'function' ? metaOrFn : fn!
  registerIt(name, testFn, meta)
}

/**
 * Defines a single test case. The optional `TestContext` argument `t` provides
 * mock helpers and per-test cleanup registration.
 *
 * @example
 * it('returns 200 for the home route', async () => {
 *   const res = await router.fetch('/')
 *   assert.equal(res.status, 200)
 * })
 *
 * // Modifiers
 * it.skip('not ready yet', () => { ... })
 * it.only('focused test', () => { ... })
 * it.todo('coming soon')
 *
 * @param name - The test name shown in reporter output.
 * @param meta - Test metadata such as `skip` or `only`.
 * @param fn - The test body, receiving a {@link TestContext} as its first argument.
 */
export const it = Object.assign(itImpl, {
  skip: (name: string, fn?: TestFn) => registerIt(name, fn ?? (() => {}), { skip: true }),
  only: (name: string, fn: TestFn) => registerIt(name, fn, { only: true }),
  todo: (name: string) => {
    let suite = currentSuite ?? getImplicitRootSuite()
    if (suite.tests.some((t) => t.name === name)) {
      throw new Error(`Duplicate test name: "${name}" in suite "${suite.name || 'Global'}"`)
    }
    suite.tests.push({ name, fn: () => {}, suite, todo: true })
  },
})

/** Alias for {@link describe}. */
export const suite = describe
/** Alias for {@link it}. */
export const test = it

function chainBefore(
  existing: (() => void | Promise<void>) | undefined,
  fn: () => void | Promise<void>,
) {
  return existing
    ? async () => {
        await existing()
        await fn()
      }
    : fn
}

function chainAfter(
  existing: (() => void | Promise<void>) | undefined,
  fn: () => void | Promise<void>,
) {
  // Child/later runs first, then earlier (reverse order)
  return existing
    ? async () => {
        await fn()
        await existing()
      }
    : fn
}

/**
 * Registers a hook that runs before **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * registration order.
 *
 * @param fn - The setup function to run before each test.
 */
export function beforeEach(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.beforeEach = chainBefore(target.beforeEach, fn)
}

/**
 * Registers a hook that runs after **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order.  To run logic after a singular test, use
 * `t.after()` from the {@link TestContext}
 *
 * @param fn - The teardown function to run after each test.
 */
export function afterEach(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.afterEach = chainAfter(target.afterEach, fn)
}

/**
 * Registers a hook that runs once before **all** tests in the current suite
 * (or globally if called outside a `describe`). Multiple calls are chained in
 * registration order.
 *
 * @param fn - The setup function to run once before all tests in the suite.
 */
export function beforeAll(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.beforeAll = chainBefore(target.beforeAll, fn)
}

/**
 * Registers a hook that runs once after **all** tests in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order.
 *
 * @param fn - The teardown function to run once after all tests in the suite.
 */
export function afterAll(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.afterAll = chainAfter(target.afterAll, fn)
}

/** Alias for {@link beforeAll} — matches the `node:test` API. */
export const before = beforeAll
/** Alias for {@link afterAll} — matches the `node:test` API. */
export const after = afterAll
