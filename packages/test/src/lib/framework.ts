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
  fn: () => void | Promise<void>
  suite: TestSuite
  only?: boolean
  skip?: boolean
  todo?: boolean
}

let currentSuite: TestSuite | null = null
let rootSuites: TestSuite[] = []

// Expose for executor.ts which reads this global
;(globalThis as any).__testSuites = rootSuites

function registerDescribe(name: string, fn: () => void, flags?: { only?: boolean; skip?: boolean }) {
  if (currentSuite) throw new Error('Nested describe() not supported')
  let suite: TestSuite = { name, tests: [], ...flags }
  rootSuites.push(suite)
  currentSuite = suite
  fn()
  currentSuite = null
}

export const describe = Object.assign(
  (name: string, fn: () => void) => registerDescribe(name, fn),
  {
    skip: (name: string, fn: () => void) => registerDescribe(name, fn, { skip: true }),
    only: (name: string, fn: () => void) => registerDescribe(name, fn, { only: true }),
    todo: (name: string) => {
      if (currentSuite) throw new Error('Nested describe() not supported')
      rootSuites.push({ name, tests: [], todo: true })
    },
  },
)

function registerIt(name: string, fn: () => void | Promise<void>, flags?: { only?: boolean; skip?: boolean }) {
  if (!currentSuite) throw new Error('it() must be called inside describe()')
  currentSuite.tests.push({ name, fn, suite: currentSuite, ...flags })
}

export const it = Object.assign(
  (name: string, fn: () => void | Promise<void>) => registerIt(name, fn),
  {
    skip: (name: string, fn?: () => void | Promise<void>) => registerIt(name, fn ?? (() => {}), { skip: true }),
    only: (name: string, fn: () => void | Promise<void>) => registerIt(name, fn, { only: true }),
    todo: (name: string) => {
      if (!currentSuite) throw new Error('it.todo() must be called inside describe()')
      currentSuite.tests.push({ name, fn: () => {}, suite: currentSuite, todo: true })
    },
  },
)

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
