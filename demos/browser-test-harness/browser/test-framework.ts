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

export function setupTestFramework() {
  ;(globalThis as any).describe = function describe(name: string, fn: () => void) {
    let parentSuite = currentSuite
    let suite: TestSuite = {
      name,
      tests: [],
    }

    if (parentSuite) {
      throw new Error('Nested describe() not supported in PoC')
    } else {
      rootSuites.push(suite)
    }

    currentSuite = suite
    fn()
    currentSuite = parentSuite
  }

  ;(globalThis as any).it = function it(name: string, fn: () => void | Promise<void>) {
    if (!currentSuite) {
      throw new Error('it() must be called inside describe()')
    }

    currentSuite.tests.push({
      name,
      fn,
      suite: currentSuite,
    })
  }

  ;(globalThis as any).beforeEach = function beforeEach(fn: () => void | Promise<void>) {
    if (!currentSuite) {
      throw new Error('beforeEach() must be called inside describe()')
    }
    currentSuite.beforeEach = fn
  }

  ;(globalThis as any).afterEach = function afterEach(fn: () => void | Promise<void>) {
    if (!currentSuite) {
      throw new Error('afterEach() must be called inside describe()')
    }
    currentSuite.afterEach = fn
  }

  ;(globalThis as any).beforeAll = function beforeAll(fn: () => void | Promise<void>) {
    if (!currentSuite) {
      throw new Error('beforeAll() must be called inside describe()')
    }
    currentSuite.beforeAll = fn
  }

  ;(globalThis as any).afterAll = function afterAll(fn: () => void | Promise<void>) {
    if (!currentSuite) {
      throw new Error('afterAll() must be called inside describe()')
    }
    currentSuite.afterAll = fn
  }

  ;(globalThis as any).__testSuites = rootSuites
}
