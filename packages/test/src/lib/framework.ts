import type { TestContext } from './context.ts'

type LifecycleHookName = 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll'
type LifecycleHookFn = () => void | Promise<void>
type PendingMeta = boolean | string

interface TestOptions {
  timeout?: number
  signal?: AbortSignal
}

interface HookOptions {
  timeout?: number
  signal?: AbortSignal
}

interface LifecycleHook extends HookOptions {
  fn: LifecycleHookFn
}

interface TestSuite {
  name: string
  tests: Test[]
  only?: boolean
  skip?: PendingMeta
  todo?: PendingMeta
  beforeEach?: LifecycleHook[]
  afterEach?: LifecycleHook[]
  beforeAll?: LifecycleHook[]
  afterAll?: LifecycleHook[]
}

interface Test extends TestOptions {
  name: string
  fn: TestFn
  suite: TestSuite
  only?: boolean
  skip?: PendingMeta
  todo?: PendingMeta
}

// Holds lifecycle hooks registered at the top level (outside any describe).
// Top-level describes inherit these hooks just like nested describes inherit
// from their parent.
const rootHooks: Pick<TestSuite, LifecycleHookName> = {}

let currentSuite: TestSuite | null = null
const rootSuites: TestSuite[] = []

// Lazily-created suite for top-level it() calls outside any describe().
// Name '' causes the reporter to display these tests under "Global".
// We check rootSuites.includes() so the suite is re-created after the executor
// clears rootSuites between files (suites.length = 0) or after captureRegistration splices it.
let implicitRootSuite: TestSuite | null = null
function getImplicitRootSuite(): TestSuite {
  if (!implicitRootSuite || !rootSuites.includes(implicitRootSuite)) {
    implicitRootSuite = { name: '', tests: [] }
    copyLifecycleHooks(rootHooks, implicitRootSuite)
    rootSuites.push(implicitRootSuite)
  }
  return implicitRootSuite
}

// Expose for executor.ts which reads this global
;(globalThis as any).__testSuites = rootSuites

function registerDescribe(name: string, fn: () => void, flags?: SuiteMeta) {
  // Nested describes are flattened: "Parent > Child"
  let fullName = currentSuite ? `${currentSuite.name} > ${name}` : name
  if (rootSuites.some((s) => s.name === fullName)) {
    throw new Error(`Duplicate suite name: "${fullName}"`)
  }
  let suite: TestSuite = { name: fullName, tests: [], ...flags }

  // Children inherit `skip`/`todo`/`only` from their parent so that
  // `describe.skip('parent', () => describe('child', () => it(...)))` actually
  // skips the child's tests. The executor walks `rootSuites` as a flat list and
  // only inspects each suite's own flag, so the propagation has to happen here.
  if (isPending(currentSuite?.skip)) suite.skip = currentSuite.skip
  if (isPending(currentSuite?.todo)) suite.todo = currentSuite.todo
  if (currentSuite?.only) suite.only = true

  copyLifecycleHooks(currentSuite ?? rootHooks, suite)

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
 * describe('external service', { skip: 'requires API credentials' }, () => { ... })
 *
 * // Modifiers
 * describe.skip('skipped suite', () => { ... })
 * describe.skip('skipped suite', 'blocked by missing fixture', () => { ... })
 * describe.only('focused suite', () => { ... })
 * describe.todo('planned suite')
 * describe.todo('planned suite', 'needs design input')
 *
 * @param name - The suite name shown in reporter output.
 * @param meta - Suite metadata such as `skip`, `only`, or `todo`.
 * @param fn - A function that registers the tests and lifecycle hooks in this suite.
 */
export const describe = Object.assign(describeImpl, {
  skip: describeSkip,
  only: (name: string, fn: () => void) => registerDescribe(name, fn, { only: true }),
  todo: describeTodo,
})

type SuiteMeta = { skip?: PendingMeta; only?: boolean; todo?: PendingMeta }
type TestMeta = TestOptions & {
  skip?: PendingMeta
  only?: boolean
  todo?: PendingMeta
}
type TestFn = (t: TestContext) => void | Promise<void>

function registerIt(name: string, fn: TestFn, flags?: TestMeta) {
  let suite = currentSuite ?? getImplicitRootSuite()
  if (suite.tests.some((t) => t.name === name)) {
    throw new Error(`Duplicate test name: "${name}" in suite "${suite.name || 'Global'}"`)
  }
  validateTimeout(flags?.timeout)
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
 * it.skip('not ready yet', 'blocked by missing fixture')
 * it.only('focused test', () => { ... })
 * it.todo('coming soon')
 * it.todo('coming soon', 'needs retry coverage')
 * it('fails if it takes too long', { timeout: 5_000 }, async (t) => {
 *   await fetch('/api/data', { signal: t.signal })
 * })
 *
 * @param name - The test name shown in reporter output.
 * @param meta - Test metadata such as `skip`, `only`, `todo`, `timeout`, or `signal`.
 * @param fn - The test body, receiving a {@link TestContext} as its first argument.
 */
export const it = Object.assign(itImpl, {
  skip: itSkip,
  only: (name: string, fn: TestFn) => registerIt(name, fn, { only: true }),
  todo: itTodo,
})

/** Alias for {@link describe}. */
export const suite = describe
/** Alias for {@link it}. */
export const test = it

function copyLifecycleHooks(source: Pick<TestSuite, LifecycleHookName>, target: TestSuite): void {
  if (source.beforeEach) target.beforeEach = [...source.beforeEach]
  if (source.afterEach) target.afterEach = [...source.afterEach]
  if (source.beforeAll) target.beforeAll = [...source.beforeAll]
  if (source.afterAll) target.afterAll = [...source.afterAll]
}

function describeSkip(name: string, fn: () => void): void
function describeSkip(name: string, reason: string, fn: () => void): void
function describeSkip(name: string, reasonOrFn: string | (() => void), fn?: () => void): void {
  let suiteFn = typeof reasonOrFn === 'function' ? reasonOrFn : fn
  if (!suiteFn) {
    throw new TypeError('describe.skip requires a function')
  }
  registerDescribe(name, suiteFn, { skip: typeof reasonOrFn === 'string' ? reasonOrFn : true })
}

function describeTodo(name: string, reason?: string): void {
  registerDescribe(name, () => {}, { todo: reason ?? true })
}

function itSkip(name: string): void
function itSkip(name: string, fn: TestFn): void
function itSkip(name: string, reason: string): void
function itSkip(name: string, reason: string, fn: TestFn): void
function itSkip(name: string, reasonOrFn?: string | TestFn, fn?: TestFn): void {
  let testFn = typeof reasonOrFn === 'function' ? reasonOrFn : fn
  registerIt(name, testFn ?? (() => {}), {
    skip: typeof reasonOrFn === 'string' ? reasonOrFn : true,
  })
}

function itTodo(name: string, reason?: string): void {
  registerIt(name, () => {}, { todo: reason ?? true })
}

function isPending(value: PendingMeta | undefined): value is true | string {
  return value === true || typeof value === 'string'
}

function registerLifecycleHook(
  name: LifecycleHookName,
  fn?: LifecycleHookFn,
  options: HookOptions = {},
): void {
  if (!fn) {
    throw new TypeError(`${name} requires a function`)
  }

  validateTimeout(options.timeout)

  let target = currentSuite ?? rootHooks
  target[name] ??= []
  target[name].push({ fn, ...options })
}

function validateTimeout(timeout: number | undefined): void {
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0)) {
    throw new RangeError('Test timeout must be a non-negative finite number')
  }
}

/**
 * Registers a hook that runs before **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * registration order. Pass `{ timeout, signal }` after the function to limit
 * how long the hook may run.
 *
 * @param fn - The setup function to run before each test.
 * @param options - Optional timeout and abort signal configuration.
 */
export function beforeEach(fn: LifecycleHookFn, options?: HookOptions): void {
  registerLifecycleHook('beforeEach', fn, options)
}

/**
 * Registers a hook that runs after **each** test in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order.  To run logic after a singular test, use
 * `t.after()` from the {@link TestContext}. Pass `{ timeout, signal }` after
 * the function to limit how long the hook may run.
 *
 * @param fn - The teardown function to run after each test.
 * @param options - Optional timeout and abort signal configuration.
 */
export function afterEach(fn: LifecycleHookFn, options?: HookOptions): void {
  registerLifecycleHook('afterEach', fn, options)
}

/**
 * Registers a hook that runs once before **all** tests in the current suite
 * (or globally if called outside a `describe`). Multiple calls are chained in
 * registration order. Pass `{ timeout, signal }` after the function to limit
 * how long the hook may run.
 *
 * @param fn - The setup function to run once before all tests in the suite.
 * @param options - Optional timeout and abort signal configuration.
 */
export function beforeAll(fn: LifecycleHookFn, options?: HookOptions): void {
  registerLifecycleHook('beforeAll', fn, options)
}

/**
 * Registers a hook that runs once after **all** tests in the current suite (or
 * globally if called outside a `describe`). Multiple calls are chained in
 * reverse registration order. Pass `{ timeout, signal }` after the function
 * to limit how long the hook may run.
 *
 * @param fn - The teardown function to run once after all tests in the suite.
 * @param options - Optional timeout and abort signal configuration.
 */
export function afterAll(fn: LifecycleHookFn, options?: HookOptions): void {
  registerLifecycleHook('afterAll', fn, options)
}

/** Alias for {@link beforeAll} — matches the `node:test` API. */
export const before = beforeAll
/** Alias for {@link afterAll} — matches the `node:test` API. */
export const after = afterAll
