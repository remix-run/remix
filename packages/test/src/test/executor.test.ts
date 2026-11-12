import * as assert from '@remix-run/assert'
import type { TestContext } from '../lib/context.ts'
import { runTests, type RunTestsOptions } from '../lib/executor.ts'
import { describe, it } from '../lib/framework.ts'
import type { TestResults } from '../lib/reporters/results.ts'

interface RunnableOptions {
  timeout?: number
  signal?: AbortSignal
}

type PendingMeta = boolean | string

interface LifecycleHook extends RunnableOptions {
  fn: () => void | Promise<void>
}

interface SuiteFixture {
  name: string
  tests: TestFixture[]
  only?: boolean
  skip?: PendingMeta
  todo?: PendingMeta
  beforeEach?: LifecycleHook[]
  afterEach?: LifecycleHook[]
  beforeAll?: LifecycleHook[]
  afterAll?: LifecycleHook[]
}

interface TestFixture extends RunnableOptions {
  name: string
  fn: (t: TestContext) => void | Promise<void>
  only?: boolean
  skip?: PendingMeta
  todo?: PendingMeta
}

type TestSuitesGlobal = typeof globalThis & { __testSuites?: SuiteFixture[] }

describe('runTests lifecycle hook failures', () => {
  it('restores property and accessor mocks after test and cleanup failures and continues', async () => {
    let target = {
      value: 1,
      get accessor() {
        return 1
      },
      get late() {
        return 1
      },
    }
    let descriptors = Object.getOwnPropertyDescriptors(target)
    let order: string[] = []
    let results = await runWithSuites([
      {
        name: 'suite',
        afterEach: [
          {
            fn() {
              order.push('afterEach')
            },
          },
        ],
        tests: [
          {
            name: 'failed test',
            fn(t) {
              t.after(() => {
                order.push('first cleanup')
                throw new Error('cleanup failed')
              })
              t.mock.property(target, 'value', 2)
              t.mock.getter(target, 'accessor', () => 2)
              t.after(() => {
                order.push('second cleanup')
                t.mock.getter(target, 'late', () => 2)
              })
              throw new Error('test failed')
            },
          },
          {
            name: 'next test',
            fn() {
              assert.deepEqual(Object.getOwnPropertyDescriptors(target), descriptors)
            },
          },
        ],
      },
    ])
    assert.equal(results.failed, 1)
    assert.equal(results.passed, 1)
    assert.match(
      results.tests[0].error?.message ?? '',
      /test failed\ncleanup failed: cleanup failed/,
    )
    assert.deepEqual(order, ['first cleanup', 'second cleanup', 'afterEach', 'afterEach'])
  })

  it('attempts other mock restorations when one descriptor can no longer be restored', async () => {
    let target = { first: 1, second: 2 }
    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'failed restore',
            fn(t) {
              t.mock.property(target, 'first', 3)
              t.mock.property(target, 'second', 4)
              Object.defineProperty(target, 'second', { configurable: false })
            },
          },
        ],
      },
    ])
    assert.equal(results.failed, 1)
    assert.equal(target.first, 1)
    assert.match(results.tests[0].error?.message ?? '', /cleanup failed/)
  })

  it('reports cleanup errors with cyclic causes without recursing indefinitely', async () => {
    let error = new Error('cyclic cleanup failure')
    error.cause = error
    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'test',
            fn(t) {
              t.after(() => {
                throw error
              })
            },
          },
        ],
      },
    ])

    assert.equal(results.failed, 1)
    assert.ok(error.stack)
    assert.ok(results.tests[0].error?.stack?.includes(error.stack))
  })

  it('retains all cleanup stacks alongside body and afterEach failures', async () => {
    let bodyError: Error | undefined
    let firstCleanupError: Error | undefined
    let secondCleanupError: Error | undefined
    let afterEachError: Error | undefined
    function firstCleanup() {
      firstCleanupError = new Error('first cleanup failed')
      throw firstCleanupError
    }
    function secondCleanup() {
      secondCleanupError = new Error('second cleanup failed')
      throw secondCleanupError
    }
    function afterEachFailure() {
      afterEachError = new Error('afterEach failed')
      throw afterEachError
    }
    let results = await runWithSuites([
      {
        name: 'suite',
        afterEach: [{ fn: afterEachFailure }],
        tests: [
          {
            name: 'test',
            fn(t) {
              t.after(firstCleanup)
              t.after(secondCleanup)
              bodyError = new Error('body failed')
              throw bodyError
            },
          },
        ],
      },
    ])

    assert.equal(results.failed, 1)
    let failure = results.tests[0].error
    assert.match(failure?.message ?? '', /body failed/)
    assert.match(failure?.message ?? '', /first cleanup failed/)
    assert.match(failure?.message ?? '', /second cleanup failed/)
    assert.match(failure?.message ?? '', /afterEach failed/)
    assert.ok(bodyError?.stack)
    assert.ok(firstCleanupError?.stack)
    assert.ok(secondCleanupError?.stack)
    assert.ok(afterEachError?.stack)
    assert.ok(failure?.stack?.includes(bodyError.stack))
    assert.ok(failure?.stack?.includes(firstCleanupError.stack))
    assert.ok(failure?.stack?.includes(secondCleanupError.stack))
    assert.ok(failure?.stack?.includes(afterEachError.stack))
  })

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
  it('prevents timed out async tests from enabling clocks in a later test', async () => {
    let resume = Promise.withResolvers<void>()
    let resumed = Promise.withResolvers<void>()
    let lateClock: ReturnType<TestContext['useFakeTimers']> | undefined
    let lateError: unknown
    let originalDate = Date
    try {
      let results = await runWithSuites([
        {
          name: 'suite',
          tests: [
            {
              name: 'timed out test',
              timeout: 5,
              async fn(t) {
                t.useFakeTimers()
                await resume.promise
                try {
                  lateClock = t.useFakeTimers({ now: 1000 })
                } catch (error) {
                  lateError = error
                } finally {
                  resumed.resolve()
                }
              },
            },
            {
              name: 'later test',
              async fn() {
                resume.resolve()
                await resumed.promise
                assert.equal(Date, originalDate)
                assert.ok(lateError instanceof Error)
                assert.match(lateError.message, /finished/)
              },
            },
          ],
        },
      ])
      assert.equal(results.failed, 1)
      assert.equal(results.passed, 1)
      assert.match(results.tests[0].error?.message ?? '', /Test timed out/)
    } finally {
      lateClock?.restore()
    }
  })

  it('keeps runner deadlines independent of replaced global timers', async (t) => {
    let setTimeoutSpy = t.mock.method(globalThis, 'setTimeout', () => {
      throw new Error('global timer used for a runner deadline')
    })
    let clearTimeoutSpy = t.mock.method(globalThis, 'clearTimeout')

    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'timed out test',
            timeout: 5,
            fn() {
              return new Promise(() => {})
            },
          },
        ],
      },
    ])

    assert.equal(results.failed, 1)
    assert.match(results.tests[0].error?.message ?? '', /Test timed out after 5ms/)
    assert.equal(setTimeoutSpy.mock.callCount(), 0)
    assert.equal(clearTimeoutSpy.mock.callCount(), 0)
  })

  it('cancels unfinished polling before the next test without aborting the public signal', async () => {
    let attempt = Promise.withResolvers<never>()
    let stopped: Promise<unknown> | undefined
    let signal: AbortSignal | undefined
    let attempts = 0
    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'starts polling',
            fn(t) {
              signal = t.signal
              stopped = t
                .waitFor(
                  () => {
                    attempts++
                    return attempt.promise
                  },
                  { interval: 0 },
                )
                .catch((error: unknown) => error)
            },
          },
          {
            name: 'runs after polling stops',
            async fn() {
              let error = await stopped
              assert.ok(error instanceof Error)
              assert.equal(error.name, 'AbortError')
              assert.equal(signal?.aborted, false)
              attempt.reject(new Error('late failure'))
              await assert.rejects(attempt.promise, /late failure/)
              assert.equal(attempts, 1)
            },
          },
        ],
      },
    ])
    assert.equal(results.passed, 2)
    assert.equal(results.failed, 0)
  })

  it('runs test and hook watchdogs while timers are mocked', { timeout: 1000 }, async (t) => {
    t.useFakeTimers()

    let results = await runWithSuites([
      {
        name: 'suite',
        afterEach: [{ timeout: 5, fn: () => new Promise(() => {}) }],
        tests: [{ name: 'test', timeout: 5, fn: () => new Promise(() => {}) }],
      },
    ])

    assert.equal(results.failed, 1)
    assert.match(results.tests[0]?.error?.message ?? '', /Test timed out after 5ms/)
    assert.match(results.tests[0]?.error?.message ?? '', /afterEach timed out after 5ms/)
  })

  it('fails tests that exceed their timeout and aborts the test signal', async () => {
    let aborted = false
    let signal: AbortSignal | undefined
    let pollingError: unknown

    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'slow test',
            timeout: 5,
            fn(t) {
              signal = t.signal
              t.signal.addEventListener(
                'abort',
                () => {
                  aborted = true
                },
                { once: true },
              )
              return t
                .waitFor(() => new Promise<void>(() => {}))
                .catch((error: unknown) => {
                  pollingError = error
                  throw error
                })
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
    assert.ok(pollingError instanceof Error)
    assert.equal(pollingError, signal?.reason)
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
    let testStarted = Promise.withResolvers<void>()
    let signal: AbortSignal | undefined
    let pollingError: unknown
    let attempt = Promise.withResolvers<void>()

    let resultsPromise = runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'aborted test',
            signal: controller.signal,
            fn(t) {
              signal = t.signal
              t.signal.addEventListener(
                'abort',
                () => {
                  testSignalAborted = true
                },
                { once: true },
              )
              testStarted.resolve()
              return t
                .waitFor(() => attempt.promise)
                .catch((error: unknown) => {
                  pollingError = error
                  throw error
                })
            },
          },
        ],
      },
    ])

    await testStarted.promise
    controller.abort(new Error('stop'))
    let results = await resultsPromise
    attempt.resolve()
    await attempt.promise

    assert.equal(testSignalAborted, true)
    assert.equal(results.passed, 0)
    assert.equal(results.failed, 1)
    assert.match(results.tests[0]?.error?.message ?? '', /Test aborted: stop/)
    assert.ok(pollingError instanceof Error)
    assert.equal(pollingError, signal?.reason)
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

describe('runTests only filtering', () => {
  it('focuses it.only across the entire test module', async () => {
    let ran: string[] = []

    let results = await runWithSuites([
      {
        name: 'first suite',
        tests: [
          {
            name: 'unfocused sibling',
            fn() {
              ran.push('unfocused sibling')
            },
          },
          {
            name: 'focused test',
            only: true,
            fn() {
              ran.push('focused test')
            },
          },
        ],
      },
      {
        name: 'second suite',
        beforeAll: [
          {
            fn() {
              ran.push('second suite beforeAll')
            },
          },
        ],
        tests: [
          {
            name: 'unfocused cross-suite test',
            fn() {
              ran.push('unfocused cross-suite test')
            },
          },
        ],
      },
    ])

    assert.deepEqual(ran, ['focused test'])
    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 2)
    assert.deepEqual(
      results.tests.map((test) => [test.suiteName, test.name, test.status]),
      [
        ['first suite', 'unfocused sibling', 'skipped'],
        ['first suite', 'focused test', 'passed'],
        ['second suite', 'unfocused cross-suite test', 'skipped'],
      ],
    )
  })

  it('runs it.only tests from multiple suites', async () => {
    let ran: string[] = []

    let results = await runWithSuites([
      {
        name: 'first suite',
        tests: [
          {
            name: 'first focused test',
            only: true,
            fn() {
              ran.push('first focused test')
            },
          },
        ],
      },
      {
        name: 'second suite',
        tests: [
          {
            name: 'unfocused test',
            fn() {
              ran.push('unfocused test')
            },
          },
          {
            name: 'second focused test',
            only: true,
            fn() {
              ran.push('second focused test')
            },
          },
        ],
      },
    ])

    assert.deepEqual(ran, ['first focused test', 'second focused test'])
    assert.equal(results.passed, 2)
    assert.equal(results.skipped, 1)
  })

  it('runs the union of describe.only suites and it.only tests', async () => {
    let ran: string[] = []

    let results = await runWithSuites([
      {
        name: 'focused suite',
        only: true,
        tests: [
          {
            name: 'suite-focused test',
            fn() {
              ran.push('suite-focused test')
            },
          },
          {
            name: 'suite-focused sibling',
            fn() {
              ran.push('suite-focused sibling')
            },
          },
        ],
      },
      {
        name: 'test-focused suite',
        tests: [
          {
            name: 'unfocused sibling',
            fn() {
              ran.push('unfocused sibling')
            },
          },
          {
            name: 'focused test',
            only: true,
            fn() {
              ran.push('focused test')
            },
          },
        ],
      },
      {
        name: 'unfocused suite',
        tests: [
          {
            name: 'unfocused cross-suite test',
            fn() {
              ran.push('unfocused cross-suite test')
            },
          },
        ],
      },
    ])

    assert.deepEqual(ran, ['suite-focused test', 'suite-focused sibling', 'focused test'])
    assert.equal(results.passed, 3)
    assert.equal(results.skipped, 2)
    assert.deepEqual(
      results.tests.map((test) => [test.suiteName, test.name, test.status]),
      [
        ['focused suite', 'suite-focused test', 'passed'],
        ['focused suite', 'suite-focused sibling', 'passed'],
        ['test-focused suite', 'unfocused sibling', 'skipped'],
        ['test-focused suite', 'focused test', 'passed'],
        ['unfocused suite', 'unfocused cross-suite test', 'skipped'],
      ],
    )
  })

  it('focuses tests matching --only patterns by full test name', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'math',
          tests: [
            {
              name: 'adds numbers',
              fn() {
                ran.push('adds')
              },
            },
            {
              name: 'subtracts numbers',
              fn() {
                ran.push('subtracts')
              },
            },
          ],
        },
      ],
      { only: [{ source: 'math > adds', flags: '' }] },
    )

    assert.deepEqual(ran, ['adds'])
    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 1)
    assert.deepEqual(
      results.tests.map((test) => [test.name, test.status]),
      [
        ['adds numbers', 'passed'],
        ['subtracts numbers', 'skipped'],
      ],
    )
  })

  it('focuses suites matching --only patterns by suite name', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'focused suite',
          tests: [
            {
              name: 'first test',
              fn() {
                ran.push('first')
              },
            },
            {
              name: 'second test',
              fn() {
                ran.push('second')
              },
            },
          ],
        },
        {
          name: 'regular suite',
          tests: [
            {
              name: 'third test',
              fn() {
                ran.push('third')
              },
            },
          ],
        },
      ],
      { only: [{ source: '^focused suite$', flags: '' }] },
    )

    assert.deepEqual(ran, ['first', 'second'])
    assert.equal(results.passed, 2)
    assert.equal(results.skipped, 1)
  })

  it('unions --only patterns with authored .only modifiers', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'authored suite',
          only: true,
          tests: [
            {
              name: 'runs from describe.only',
              fn() {
                ran.push('describe.only')
              },
            },
          ],
        },
        {
          name: 'pattern suite',
          tests: [
            {
              name: 'runs from --only',
              fn() {
                ran.push('--only')
              },
            },
          ],
        },
        {
          name: 'regular suite',
          tests: [
            {
              name: 'does not run',
              fn() {
                ran.push('regular')
              },
            },
          ],
        },
      ],
      { only: [{ source: 'pattern suite > runs', flags: '' }] },
    )

    assert.deepEqual(ran, ['describe.only', '--only'])
    assert.equal(results.passed, 2)
    assert.equal(results.skipped, 1)
  })

  it('skips every test when --only patterns do not match', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'suite',
          beforeAll: [
            {
              fn() {
                ran.push('beforeAll')
              },
            },
          ],
          tests: [
            {
              name: 'test',
              fn() {
                ran.push('test')
              },
            },
          ],
        },
      ],
      { only: [{ source: 'missing', flags: '' }] },
    )

    assert.deepEqual(ran, [])
    assert.equal(results.passed, 0)
    assert.equal(results.skipped, 1)
    assert.deepEqual(
      results.tests.map((test) => [test.name, test.status]),
      [['test', 'skipped']],
    )
  })
})

describe('runTests skip and todo reasons', () => {
  it('preserves suite skip reasons on skipped test results', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        skip: 'requires database credentials',
        tests: [
          {
            name: 'test',
            fn() {},
          },
        ],
      },
    ])

    assert.equal(results.skipped, 1)
    assert.equal(results.tests[0]?.status, 'skipped')
    assert.equal(results.tests[0]?.reason, 'requires database credentials')
  })

  it('preserves test skip and todo reasons on pending test results', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'skipped test',
            skip: 'needs a fixture',
            fn() {},
          },
          {
            name: 'todo test',
            todo: 'needs retry coverage',
            fn() {},
          },
        ],
      },
    ])

    assert.equal(results.skipped, 1)
    assert.equal(results.todo, 1)
    assert.equal(results.tests[0]?.status, 'skipped')
    assert.equal(results.tests[0]?.reason, 'needs a fixture')
    assert.equal(results.tests[1]?.status, 'todo')
    assert.equal(results.tests[1]?.reason, 'needs retry coverage')
  })

  it('preserves todo suite reasons on placeholder results', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        todo: 'waiting on design',
        tests: [],
      },
    ])

    assert.equal(results.todo, 1)
    assert.equal(results.tests[0]?.name, '')
    assert.equal(results.tests[0]?.status, 'todo')
    assert.equal(results.tests[0]?.reason, 'waiting on design')
  })

  it('treats an empty string skip reason as skipped without a displayed reason', async () => {
    let results = await runWithSuites([
      {
        name: 'suite',
        tests: [
          {
            name: 'skipped test',
            skip: '',
            fn() {},
          },
        ],
      },
    ])

    assert.equal(results.skipped, 1)
    assert.equal(results.tests[0]?.status, 'skipped')
    assert.equal(results.tests[0]?.reason, undefined)
  })
})

async function runWithSuites(
  suites: SuiteFixture[],
  options?: RunTestsOptions,
): Promise<TestResults> {
  let global = globalThis as TestSuitesGlobal
  let previousSuites = global.__testSuites

  global.__testSuites = suites
  try {
    return await runTests(options)
  } finally {
    global.__testSuites = previousSuites
  }
}
