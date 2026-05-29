import * as assert from '@remix-run/assert'
import type { TestContext } from '../lib/context.ts'
import { runTests } from '../lib/executor.ts'
import { describe, it } from '../lib/framework.ts'
import type { TestResults } from '../lib/reporters/results.ts'

interface RunnableOptions {
  timeout?: number
  signal?: AbortSignal
}

interface LifecycleHook extends RunnableOptions {
  fn: () => void | Promise<void>
}

interface SuiteFixture {
  name: string
  tests: TestFixture[]
  only?: boolean
  skip?: boolean
  todo?: boolean
  beforeEach?: LifecycleHook[]
  afterEach?: LifecycleHook[]
  beforeAll?: LifecycleHook[]
  afterAll?: LifecycleHook[]
}

interface TestFixture extends RunnableOptions {
  name: string
  fn: (t: TestContext) => void | Promise<void>
  only?: boolean
  skip?: boolean
  todo?: boolean
}

type TestSuitesGlobal = typeof globalThis & { __testSuites?: SuiteFixture[] }

describe('runTests lifecycle hook failures', () => {
  it('reports beforeAll failures as failed results', async () => {
    let testRan = false

    let results = await runWithSuites([
      {
        name: 'suite',
        beforeAll: [
          {
            fn() {
              throw new Error('setup failed')
            },
          },
        ],
        tests: [
          {
            name: 'test',
            fn() {
              testRan = true
            },
          },
        ],
      },
    ])

    assert.equal(testRan, false)
    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.equal(results.tests.length, 1)

    let failure = results.tests[0]
    assert.ok(failure)
    assert.equal(failure.name, 'beforeAll')
    assert.equal(failure.suiteName, 'suite')
    assert.equal(failure.status, 'failed')
    assert.match(failure.error?.message ?? '', /beforeAll failed: setup failed/)
  })

  it('reports afterEach failures on the affected test', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        afterEach: [
          {
            fn() {
              throw new Error('teardown failed')
            },
          },
        ],
        tests: [
          {
            name: 'test',
            fn() {},
          },
        ],
      },
    ])

    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.equal(results.tests.length, 1)

    let failure = results.tests[0]
    assert.ok(failure)
    assert.equal(failure.name, 'test')
    assert.equal(failure.suiteName, 'suite')
    assert.equal(failure.status, 'failed')
    assert.match(failure.error?.message ?? '', /afterEach failed: teardown failed/)
  })

  it('reports afterAll failures as failed results', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        afterAll: [
          {
            fn() {
              throw new Error('teardown failed')
            },
          },
        ],
        tests: [
          {
            name: 'test',
            fn() {},
          },
        ],
      },
    ])

    assert.equal(results.passed, 1)
    assert.equal(results.failed, 1)
    assert.equal(results.tests.length, 2)

    let passed = results.tests[0]
    let failure = results.tests[1]
    assert.ok(passed)
    assert.ok(failure)
    assert.equal(passed.name, 'test')
    assert.equal(passed.status, 'passed')
    assert.equal(failure.name, 'afterAll')
    assert.equal(failure.suiteName, 'suite')
    assert.equal(failure.status, 'failed')
    assert.match(failure.error?.message ?? '', /afterAll failed: teardown failed/)
  })
})

describe('runTests timeouts and signals', () => {
  it('fails tests that exceed their timeout and aborts the test signal', async () => {
    let aborted = false

    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'slow test',
            timeout: 5,
            fn(t) {
              t.signal.addEventListener(
                'abort',
                () => {
                  aborted = true
                },
                { once: true },
              )
              return new Promise(() => {})
            },
          },
        ],
      },
    ])

    assert.equal(aborted, true)
    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.equal(results.tests.length, 1)
    assert.equal(results.tests[0]?.status, 'failed')
    assert.match(results.tests[0]?.error?.message ?? '', /Test timed out after 5ms/)
  })

  it('exposes a non-aborted signal to regular tests', async () => {
    let sawSignal = false

    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'signal test',
            fn(t) {
              sawSignal = t.signal instanceof AbortSignal && !t.signal.aborted
            },
          },
        ],
      },
    ])

    assert.equal(sawSignal, true)
    assert.equal(results.passed, 1)
    assert.equal(results.failed, 0)
  })

  it('aborts the test signal when a user-provided signal aborts', async () => {
    let controller = new AbortController()
    let testSignalAborted = false

    let resultsPromise = runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'aborted test',
            signal: controller.signal,
            fn(t) {
              t.signal.addEventListener(
                'abort',
                () => {
                  testSignalAborted = true
                },
                { once: true },
              )
              return new Promise(() => {})
            },
          },
        ],
      },
    ])

    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort(new Error('stop'))
    let results = await resultsPromise

    assert.equal(testSignalAborted, true)
    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.match(results.tests[0]?.error?.message ?? '', /Test aborted: stop/)
  })

  it('reports beforeAll timeouts as failed hook results', async () => {
    let testRan = false

    let results = await runWithSuites([
      {
        name: 'suite',
        beforeAll: [
          {
            timeout: 5,
            fn() {
              return new Promise(() => {})
            },
          },
        ],
        tests: [
          {
            name: 'test',
            fn() {
              testRan = true
            },
          },
        ],
      },
    ])

    assert.equal(testRan, false)
    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.equal(results.tests.length, 1)
    assert.equal(results.tests[0]?.name, 'beforeAll')
    assert.match(results.tests[0]?.error?.message ?? '', /beforeAll failed: beforeAll timed out/)
  })

  it('reports afterEach timeouts on the affected test', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        afterEach: [
          {
            timeout: 5,
            fn() {
              return new Promise(() => {})
            },
          },
        ],
        tests: [
          {
            name: 'test',
            fn() {},
          },
        ],
      },
    ])

    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.equal(results.tests.length, 1)
    assert.equal(results.tests[0]?.name, 'test')
    assert.match(results.tests[0]?.error?.message ?? '', /afterEach failed: afterEach timed out/)
  })
})

async function runWithSuites(suites: SuiteFixture[]): Promise<TestResults> {
  let global = globalThis as TestSuitesGlobal
  let previousSuites = global.__testSuites

  global.__testSuites = suites
  try {
    return await runTests()
  } finally {
    global.__testSuites = previousSuites
  }
}
