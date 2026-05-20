import * as assert from '@remix-run/assert'
import type { TestContext } from '../lib/context.ts'
import { runTests } from '../lib/executor.ts'
import { describe, it } from '../lib/framework.ts'
import type { TestResults } from '../lib/reporters/results.ts'

type LifecycleHook = () => void | Promise<void>

interface SuiteFixture {
  name: string
  tests: TestFixture[]
  only?: boolean
  skip?: boolean
  todo?: boolean
  beforeEach?: LifecycleHook
  afterEach?: LifecycleHook
  beforeAll?: LifecycleHook
  afterAll?: LifecycleHook
}

interface TestFixture {
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
        beforeAll() {
          throw new Error('setup failed')
        },
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
        afterEach() {
          throw new Error('teardown failed')
        },
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
        afterAll() {
          throw new Error('teardown failed')
        },
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
