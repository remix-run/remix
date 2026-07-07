import { createTestContext, type CreateTestContextE2EOptions, type TestContext } from './context.ts'
import type { V8CoverageEntry } from './coverage.ts'
import type { TestResult, TestResults } from './reporters/results.ts'
import type { SerializedOnlyPattern } from './config.ts'

type PendingMeta = boolean | string

interface RunnableOptions {
  timeout?: number
  signal?: AbortSignal
}

interface LifecycleHook extends RunnableOptions {
  fn: () => void | Promise<void>
}

interface RegisteredSuite {
  name: string
  tests: RegisteredTest[]
  only?: boolean
  skip?: PendingMeta
  todo?: PendingMeta
  beforeEach?: LifecycleHook[]
  afterEach?: LifecycleHook[]
  beforeAll?: LifecycleHook[]
  afterAll?: LifecycleHook[]
}

interface RegisteredTest extends RunnableOptions {
  name: string
  fn: (t: TestContext) => void | Promise<void>
  only?: boolean
  skip?: PendingMeta
  todo?: PendingMeta
}

type RunTestsE2EOptions = Omit<CreateTestContextE2EOptions, 'addE2ECoverageEntries'>

export interface RunTestsOptions extends Partial<RunTestsE2EOptions> {
  only?: SerializedOnlyPattern[]
}

export async function runTests(options?: RunTestsOptions): Promise<TestResults> {
  let suites = getRegisteredSuites()
  let e2eCoverageEntries: Array<{ entries: V8CoverageEntry[]; baseUrl: string }> = []
  let results: TestResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    todo: 0,
    tests: [],
  }

  let onlyRegexes =
    options?.only === undefined || options.only.length === 0
      ? undefined
      : options.only.map((pattern) => new RegExp(pattern.source, pattern.flags))
  let hasOnlyPatterns = onlyRegexes !== undefined
  let hasOnlySuites = false
  let hasOnlyTests = false

  for (let suite of suites) {
    if (onlyRegexes && matchesAny(onlyRegexes, suite.name)) {
      suite.only = true
    }
    hasOnlySuites ||= suite.only === true

    for (let test of suite.tests) {
      if (onlyRegexes && matchesAny(onlyRegexes, getFullTestName(suite.name, test.name))) {
        test.only = true
      }
      hasOnlyTests ||= test.only === true
    }

    if (!onlyRegexes && hasOnlySuites && hasOnlyTests) break
  }

  let hasOnly = hasOnlyPatterns || hasOnlySuites || hasOnlyTests

  for (let suite of suites) {
    let suiteHasOnlyTests = suite.tests.some((test) => test.only)

    // If any suite or test uses .only, skip suites that do not contain focused work
    if (hasOnly && !suite.only && !suiteHasOnlyTests) {
      for (let test of suite.tests) {
        results.tests.push(createPendingResult(test.name, suite.name, 'skipped'))
        results.skipped++
      }
      continue
    }

    let suitePendingStatus = getPendingStatus(suite)
    if (suitePendingStatus) {
      let reason = getPendingReason(suite, suitePendingStatus)
      for (let test of suite.tests) {
        results.tests.push(createPendingResult(test.name, suite.name, suitePendingStatus, reason))
        results[suitePendingStatus]++
      }
      // describe.todo('name') with no tests — add placeholder so suite appears in output
      if (suite.tests.length === 0) {
        results.tests.push(createPendingResult('', suite.name, suitePendingStatus, reason))
        results[suitePendingStatus]++
      }
      continue
    }

    if (suite.beforeAll) {
      let startTime = performance.now()
      try {
        await runLifecycleHooks('beforeAll', suite.beforeAll)
      } catch (error) {
        results.tests.push(
          createFailedHookResult('beforeAll', suite.name, error, performance.now() - startTime),
        )
        results.failed++
        continue
      }
    }

    for (let test of suite.tests) {
      // If any suite or test uses .only, skip tests that are not focused
      if (hasOnly && !suite.only && !test.only) {
        results.tests.push(createPendingResult(test.name, suite.name, 'skipped'))
        results.skipped++
        continue
      }

      let testPendingStatus = getPendingStatus(test)
      if (testPendingStatus) {
        results.tests.push(
          createPendingResult(
            test.name,
            suite.name,
            testPendingStatus,
            getPendingReason(test, testPendingStatus),
          ),
        )
        results[testPendingStatus]++
        continue
      }

      let startTime = performance.now()
      let result: TestResult = {
        name: test.name,
        suiteName: suite.name,
        status: 'passed',
        duration: 0,
      }
      let testError: unknown
      let afterEachError: unknown
      let testFailed = false
      let afterEachFailed = false

      let testAbortController = new AbortController()
      let { testContext, cleanup } = createTestContext({
        signal: testAbortController.signal,
        e2e: createE2EOptions(options, (e) => e2eCoverageEntries.push(e)),
      })

      try {
        if (suite.beforeEach) {
          await runLifecycleHooks('beforeEach', suite.beforeEach, testAbortController, test.signal)
        }

        await runRunnable(
          'Test',
          () => test.fn(testContext),
          test,
          testAbortController,
          test.signal,
        )
      } catch (error) {
        testFailed = true
        testError = error
      } finally {
        await cleanup()
        if (suite.afterEach) {
          try {
            await runLifecycleHooks('afterEach', suite.afterEach, undefined, undefined, true)
          } catch (error) {
            afterEachFailed = true
            afterEachError = error
          }
        }

        if (testFailed || afterEachFailed) {
          result.status = 'failed'
          result.error = createTestError(
            testFailed ? testError : undefined,
            afterEachFailed ? createHookFailure('afterEach', afterEachError) : undefined,
          )
          results.failed++
        } else {
          results.passed++
        }

        result.duration = performance.now() - startTime
        results.tests.push(result)
      }
    }

    if (suite.afterAll) {
      let startTime = performance.now()
      try {
        await runLifecycleHooks('afterAll', suite.afterAll, undefined, undefined, true)
      } catch (error) {
        results.tests.push(
          createFailedHookResult('afterAll', suite.name, error, performance.now() - startTime),
        )
        results.failed++
      }
    }
  }

  // Clear suites in-place so the shared framework module is reset
  // for the next test file (which reuses the same cached module instance)
  suites.length = 0

  if (e2eCoverageEntries.length > 0) {
    results.e2eBrowserCoverageEntries = e2eCoverageEntries
  }

  return results
}

function createE2EOptions(
  options: RunTestsOptions | undefined,
  addE2ECoverageEntries: CreateTestContextE2EOptions['addE2ECoverageEntries'],
): CreateTestContextE2EOptions | undefined {
  if (options?.browser === undefined) {
    return undefined
  }

  if (
    options.coverage === undefined ||
    options.open === undefined ||
    options.playwrightPageOptions === undefined
  ) {
    throw new Error('Incomplete E2E test options')
  }

  return {
    addE2ECoverageEntries,
    browser: options.browser,
    coverage: options.coverage,
    open: options.open,
    playwrightPageOptions: options.playwrightPageOptions,
  }
}

function getRegisteredSuites(): RegisteredSuite[] {
  let global = globalThis as typeof globalThis & { __testSuites?: RegisteredSuite[] }
  return global.__testSuites ?? []
}

function matchesAny(regexes: RegExp[], value: string): boolean {
  return regexes.some((regex) => {
    regex.lastIndex = 0
    return regex.test(value)
  })
}

function getFullTestName(suiteName: string, testName: string): string {
  return testName ? `${suiteName} > ${testName}` : suiteName
}

function getPendingStatus(value: {
  skip?: PendingMeta
  todo?: PendingMeta
}): 'skipped' | 'todo' | undefined {
  if (isPending(value.todo)) return 'todo'
  if (isPending(value.skip)) return 'skipped'
  return undefined
}

function isPending(value: PendingMeta | undefined): value is true | string {
  return value === true || typeof value === 'string'
}

function getPendingReason(
  value: { skip?: PendingMeta; todo?: PendingMeta },
  status: 'skipped' | 'todo',
): string | undefined {
  let reason = status === 'todo' ? value.todo : value.skip
  return typeof reason === 'string' && reason.length > 0 ? reason : undefined
}

function createPendingResult(
  name: string,
  suiteName: string,
  status: 'skipped' | 'todo',
  reason?: string,
): TestResult {
  let result: TestResult = {
    name,
    suiteName,
    status,
    duration: 0,
  }
  if (reason) result.reason = reason
  return result
}

async function runLifecycleHooks(
  hookName: string,
  hooks: LifecycleHook[],
  abortController?: AbortController,
  inheritedSignal?: AbortSignal,
  reverse = false,
): Promise<void> {
  let orderedHooks = reverse ? [...hooks].reverse() : hooks
  for (let hook of orderedHooks) {
    await runRunnable(hookName, hook.fn, hook, abortController, inheritedSignal, hook.signal)
  }
}

async function runRunnable(
  label: string,
  fn: () => void | Promise<void>,
  options: RunnableOptions,
  abortController?: AbortController,
  ...signals: Array<AbortSignal | undefined>
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let abortCleanups: Array<() => void> = []
  let abortSignals = [...new Set([...signals, options.signal])].filter(
    (signal): signal is AbortSignal => signal != null,
  )

  for (let signal of abortSignals) {
    if (signal.aborted) {
      let error = createAbortError(label, signal.reason)
      abortController?.abort(error)
      throw error
    }
  }

  let abortPromise = new Promise<never>((_, reject) => {
    for (let signal of abortSignals) {
      let onAbort = () => {
        let error = createAbortError(label, signal.reason)
        abortController?.abort(error)
        reject(error)
      }
      signal.addEventListener('abort', onAbort, { once: true })
      abortCleanups.push(() => signal.removeEventListener('abort', onAbort))
    }
  })

  let timeout = options.timeout
  let timeoutPromise =
    timeout && timeout > 0
      ? new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            let error = createTimeoutError(label, timeout)
            reject(error)
            abortController?.abort(error)
          }, timeout)
        })
      : undefined

  try {
    await Promise.race([
      Promise.resolve().then(fn),
      abortPromise,
      ...(timeoutPromise ? [timeoutPromise] : []),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    for (let cleanup of abortCleanups) cleanup()
  }
}

function createTimeoutError(label: string, timeout: number): Error {
  let error = new Error(`${label} timed out after ${timeout}ms`)
  error.name = 'TimeoutError'
  return error
}

function createAbortError(label: string, reason: unknown): Error {
  let message =
    reason instanceof Error ? reason.message : String(reason ?? 'This operation was aborted')
  let error = new Error(`${label} aborted: ${message}`)
  error.name = 'AbortError'
  return error
}

function createFailedHookResult(
  hookName: string,
  suiteName: string,
  error: unknown,
  duration: number,
): TestResult {
  return {
    name: hookName,
    suiteName,
    status: 'failed',
    error: createTestError(createHookFailure(hookName, error)),
    duration,
  }
}

function createHookFailure(hookName: string, error: unknown): Error {
  let cause = error instanceof Error ? error : new Error(String(error))
  return new Error(`${hookName} failed: ${cause.message}`, { cause })
}

function createTestError(
  primaryError: unknown,
  secondaryError: Error | undefined = undefined,
): TestResult['error'] {
  let message = primaryError !== undefined ? getErrorMessage(primaryError) : undefined
  let stack = primaryError instanceof Error ? primaryError.stack : undefined

  if (secondaryError) {
    message = message ? `${message}\n${secondaryError.message}` : secondaryError.message
    stack =
      stack && secondaryError.stack
        ? `${stack}\n${secondaryError.stack}`
        : (stack ?? secondaryError.stack)
  }

  return {
    message: message ?? 'Test failed',
    stack,
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
