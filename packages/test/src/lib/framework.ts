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
let rootHooks: Pick<TestSuite, 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll'> = {}

let currentSuite: TestSuite | null = null
let rootSuites: TestSuite[] = []

// Expose for executor.ts which reads this global
;(globalThis as any).__testSuites = rootSuites

function registerDescribe(name: string, fn: () => void, flags?: { only?: boolean; skip?: boolean }) {
  // Nested describes are flattened: "Parent > Child"
  let fullName = currentSuite ? `${currentSuite.name} > ${name}` : name
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

export const describe = Object.assign(
  (name: string, metaOrFn: SuiteMeta | (() => void), fn?: () => void) => {
    let meta = typeof metaOrFn === 'function' ? {} : metaOrFn
    let suiteFn = typeof metaOrFn === 'function' ? metaOrFn : fn!
    registerDescribe(name, suiteFn, meta)
  },
  {
    skip: (name: string, fn: () => void) => registerDescribe(name, fn, { skip: true }),
    only: (name: string, fn: () => void) => registerDescribe(name, fn, { only: true }),
    todo: (name: string) => {
      let fullName = currentSuite ? `${currentSuite.name} > ${name}` : name
      rootSuites.push({ name: fullName, tests: [], todo: true })
    },
  },
)

type SuiteMeta = { skip?: boolean; only?: boolean }
type TestMeta = { skip?: boolean; only?: boolean }
type TestFn = (t?: any) => void | Promise<void>

function registerIt(name: string, fn: TestFn, flags?: { only?: boolean; skip?: boolean }) {
  if (!currentSuite) throw new Error('it() must be called inside describe()')
  currentSuite.tests.push({ name, fn, suite: currentSuite, ...flags })
}

export const it = Object.assign(
  (name: string, metaOrFn: TestMeta | TestFn, fn?: TestFn) => {
    let meta = typeof metaOrFn === 'function' ? {} : metaOrFn
    let testFn = typeof metaOrFn === 'function' ? metaOrFn : fn!
    registerIt(name, testFn, meta)
  },
  {
    skip: (name: string, fn?: TestFn) => registerIt(name, fn ?? (() => {}), { skip: true }),
    only: (name: string, fn: TestFn) => registerIt(name, fn, { only: true }),
    todo: (name: string) => {
      if (!currentSuite) throw new Error('it.todo() must be called inside describe()')
      currentSuite.tests.push({ name, fn: () => {}, suite: currentSuite, todo: true })
    },
  },
)

export const suite = describe
export const test = it

function chainBefore(existing: (() => void | Promise<void>) | undefined, fn: () => void | Promise<void>) {
  return existing ? async () => { await existing(); await fn() } : fn
}

function chainAfter(existing: (() => void | Promise<void>) | undefined, fn: () => void | Promise<void>) {
  // Child/later runs first, then earlier (reverse order)
  return existing ? async () => { await fn(); await existing() } : fn
}

export function beforeEach(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.beforeEach = chainBefore(target.beforeEach, fn)
}

export function afterEach(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.afterEach = chainAfter(target.afterEach, fn)
}

export function beforeAll(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.beforeAll = chainBefore(target.beforeAll, fn)
}

export function afterAll(fn: () => void | Promise<void>) {
  let target = currentSuite ?? rootHooks
  target.afterAll = chainAfter(target.afterAll, fn)
}

// Aliases matching node:test API
export const before = beforeAll
export const after = afterAll
