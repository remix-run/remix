import * as assert from '@remix-run/assert'
import type { TestContext } from '../lib/context.ts'
import { runTests } from '../lib/executor.ts'
import { describe, it } from '../lib/framework.ts'
import type { TestResults } from '../lib/reporters/results.ts'
import type { SerializedTestNamePattern } from '../lib/config.ts'

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

describe('runTests test name patterns', () => {
  it('only runs tests with full names matching a configured pattern', async () => {
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
      { testNamePatterns: [{ source: 'math adds', flags: '' }] },
    )

    assert.deepEqual(ran, ['adds'])
    assert.equal(results.passed, 1)
    assert.equal(results.failed, 0)
    assert.equal(results.skipped, 1)
    assert.equal(results.tests.length, 1)
    assert.equal(results.tests[0]?.name, 'adds numbers')
  })

  it('counts non-matching tests as skipped without reporting them individually', async () => {
    let results = await runWithSuites(
      [
        {
          name: 'suite',
          tests: [
            {
              name: 'matching test',
              fn() {},
            },
            {
              name: 'other test',
              fn() {},
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'matching', flags: '' }] },
    )

    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 1)
    assert.deepEqual(
      results.tests.map((test) => test.name),
      ['matching test'],
    )
  })

  it('applies it.only before the configured pattern', async () => {
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
              name: 'fast path',
              fn() {
                ran.push('fast')
              },
            },
            {
              name: 'slow path',
              only: true,
              fn() {
                ran.push('slow')
              },
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'fast', flags: '' }] },
    )

    assert.deepEqual(ran, [])
    assert.equal(results.passed, 0)
    assert.equal(results.skipped, 1)
    assert.equal(results.tests.length, 0)
  })

  it('honors it.only on tests that match the configured pattern', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'suite',
          tests: [
            {
              name: 'fast path',
              only: true,
              fn() {
                ran.push('fast')
              },
            },
            {
              name: 'slow path',
              fn() {
                ran.push('slow')
              },
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'path', flags: '' }] },
    )

    assert.deepEqual(ran, ['fast'])
    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 0)
    assert.deepEqual(
      results.tests.map((test) => `${test.name}:${test.status}`),
      ['fast path:passed'],
    )
  })

  it('applies describe.only before the configured pattern', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'focused suite',
          only: true,
          tests: [
            {
              name: 'slow path',
              fn() {
                ran.push('slow')
              },
            },
          ],
        },
        {
          name: 'regular suite',
          tests: [
            {
              name: 'fast path',
              fn() {
                ran.push('fast')
              },
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'regular suite fast', flags: '' }] },
    )

    assert.deepEqual(ran, [])
    assert.equal(results.passed, 0)
    assert.equal(results.skipped, 1)
    assert.equal(results.tests.length, 0)
  })

  it('honors describe.only on suites that match the configured pattern', async () => {
    let ran: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'focused suite',
          only: true,
          tests: [
            {
              name: 'fast path',
              fn() {
                ran.push('focused')
              },
            },
          ],
        },
        {
          name: 'regular suite',
          tests: [
            {
              name: 'fast path',
              fn() {
                ran.push('regular')
              },
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'fast', flags: '' }] },
    )

    assert.deepEqual(ran, ['focused'])
    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 0)
    assert.deepEqual(
      results.tests.map((test) => `${test.suiteName} ${test.name}:${test.status}`),
      ['focused suite fast path:passed'],
    )
  })

  it('does not run suite hooks when no tests match', async () => {
    let beforeAllRan = false
    let afterAllRan = false

    let results = await runWithSuites(
      [
        {
          name: 'suite',
          beforeAll: [
            {
              fn() {
                beforeAllRan = true
              },
            },
          ],
          afterAll: [
            {
              fn() {
                afterAllRan = true
              },
            },
          ],
          tests: [
            {
              name: 'other test',
              fn() {},
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'missing', flags: '' }] },
    )

    assert.equal(beforeAllRan, false)
    assert.equal(afterAllRan, false)
    assert.equal(results.skipped, 1)
    assert.equal(results.tests.length, 0)
  })

  it('runs suite hooks once when some tests match', async () => {
    let events: string[] = []

    let results = await runWithSuites(
      [
        {
          name: 'suite',
          beforeAll: [
            {
              fn() {
                events.push('beforeAll')
              },
            },
          ],
          beforeEach: [
            {
              fn() {
                events.push('beforeEach')
              },
            },
          ],
          afterEach: [
            {
              fn() {
                events.push('afterEach')
              },
            },
          ],
          afterAll: [
            {
              fn() {
                events.push('afterAll')
              },
            },
          ],
          tests: [
            {
              name: 'matching test',
              fn() {
                events.push('test')
              },
            },
            {
              name: 'other test',
              fn() {
                events.push('other')
              },
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'matching', flags: '' }] },
    )

    assert.deepEqual(events, ['beforeAll', 'beforeEach', 'test', 'afterEach', 'afterAll'])
    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 1)
    assert.deepEqual(
      results.tests.map((test) => test.name),
      ['matching test'],
    )
  })

  it('filters empty todo suite placeholders by suite name', async () => {
    let results = await runWithSuites(
      [
        {
          name: 'matching todo',
          todo: true,
          tests: [],
        },
        {
          name: 'other todo',
          todo: true,
          tests: [],
        },
      ],
      { testNamePatterns: [{ source: '^matching todo$', flags: '' }] },
    )

    assert.equal(results.todo, 1)
    assert.equal(results.skipped, 1)
    assert.deepEqual(
      results.tests.map((test) => `${test.suiteName}:${test.status}`),
      ['matching todo:todo'],
    )
  })

  it('matches with regular expression flags', async () => {
    let results = await runWithSuites(
      [
        {
          name: 'suite',
          tests: [
            {
              name: 'UPPERCASE test',
              fn() {},
            },
          ],
        },
      ],
      { testNamePatterns: [{ source: 'uppercase', flags: 'i' }] },
    )

    assert.equal(results.passed, 1)
    assert.equal(results.skipped, 0)
    assert.equal(results.tests[0]?.name, 'UPPERCASE test')
  })
})

interface RunWithSuitesOptions {
  testNamePatterns?: SerializedTestNamePattern[]
}

async function runWithSuites(
  suites: SuiteFixture[],
  options?: RunWithSuitesOptions,
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
