import { createTestContext } from "./context.js";
export async function runTests(options) {
    let suites = getRegisteredSuites();
    let testNameMatcher = createTestNameMatcher(options?.testNamePatterns);
    let hasOnlySuites = suites.some((suite) => suite.only);
    let filteredTests = 0;
    let runnableSuites = suites.flatMap((suite) => {
        if (testNameMatcher && hasOnlySuites && !suite.only) {
            return [];
        }
        let focusedSuiteTests = testNameMatcher && suite.tests.some((test) => test.only)
            ? suite.tests.filter((test) => test.only)
            : suite.tests;
        let suiteTests = testNameMatcher
            ? focusedSuiteTests.filter((test) => testNameMatcher(suite.name, test.name))
            : focusedSuiteTests;
        let shouldIncludePendingSuitePlaceholder = suite.tests.length === 0 &&
            getPendingStatus(suite) !== undefined &&
            (testNameMatcher ? testNameMatcher(suite.name, '') : true);
        if (testNameMatcher) {
            filteredTests += focusedSuiteTests.length - suiteTests.length;
            if (suite.tests.length === 0 &&
                getPendingStatus(suite) !== undefined &&
                !shouldIncludePendingSuitePlaceholder) {
                filteredTests++;
            }
        }
        if (suiteTests.length === 0 &&
            !shouldIncludePendingSuitePlaceholder &&
            (testNameMatcher || suite.tests.length > 0)) {
            return [];
        }
        return [{ suite, suiteTests, shouldIncludePendingSuitePlaceholder }];
    });
    let e2eCoverageEntries = [];
    let results = {
        passed: 0,
        failed: 0,
        skipped: filteredTests,
        todo: 0,
        tests: [],
    };
    for (let { suite, suiteTests, shouldIncludePendingSuitePlaceholder } of runnableSuites) {
        // If any suite uses .only, skip all non-only suites
        if (hasOnlySuites && !suite.only) {
            for (let test of suiteTests) {
                results.tests.push(createPendingResult(test.name, suite.name, 'skipped'));
                results.skipped++;
            }
            continue;
        }
        let suitePendingStatus = getPendingStatus(suite);
        if (suitePendingStatus) {
            let reason = getPendingReason(suite, suitePendingStatus);
            for (let test of suiteTests) {
                results.tests.push(createPendingResult(test.name, suite.name, suitePendingStatus, reason));
                results[suitePendingStatus]++;
            }
            // Pending suites with no tests get a placeholder so the suite appears in output.
            if (shouldIncludePendingSuitePlaceholder) {
                results.tests.push(createPendingResult('', suite.name, suitePendingStatus, reason));
                results[suitePendingStatus]++;
            }
            continue;
        }
        if (suite.beforeAll) {
            let startTime = performance.now();
            try {
                await runLifecycleHooks('beforeAll', suite.beforeAll);
            }
            catch (error) {
                results.tests.push(createFailedHookResult('beforeAll', suite.name, error, performance.now() - startTime));
                results.failed++;
                continue;
            }
        }
        let hasOnlyTests = suiteTests.some((test) => test.only);
        for (let test of suiteTests) {
            // If any test uses .only, skip all non-only tests in this suite
            if (hasOnlyTests && !test.only) {
                results.tests.push(createPendingResult(test.name, suite.name, 'skipped'));
                results.skipped++;
                continue;
            }
            let testPendingStatus = getPendingStatus(test);
            if (testPendingStatus) {
                results.tests.push(createPendingResult(test.name, suite.name, testPendingStatus, getPendingReason(test, testPendingStatus)));
                results[testPendingStatus]++;
                continue;
            }
            let startTime = performance.now();
            let result = {
                name: test.name,
                suiteName: suite.name,
                status: 'passed',
                duration: 0,
            };
            let testError;
            let afterEachError;
            let testFailed = false;
            let afterEachFailed = false;
            let testAbortController = new AbortController();
            let e2eOptions = createE2EOptions(options, (e) => e2eCoverageEntries.push(e));
            let { testContext, cleanup } = createTestContext({
                signal: testAbortController.signal,
                e2e: e2eOptions,
            });
            try {
                if (suite.beforeEach) {
                    await runLifecycleHooks('beforeEach', suite.beforeEach, testAbortController, test.signal);
                }
                await runRunnable('Test', () => test.fn(testContext), test, testAbortController, test.signal);
            }
            catch (error) {
                testFailed = true;
                testError = error;
            }
            finally {
                await cleanup();
                if (suite.afterEach) {
                    try {
                        await runLifecycleHooks('afterEach', suite.afterEach, undefined, undefined, true);
                    }
                    catch (error) {
                        afterEachFailed = true;
                        afterEachError = error;
                    }
                }
                if (testFailed || afterEachFailed) {
                    result.status = 'failed';
                    result.error = createTestError(testFailed ? testError : undefined, afterEachFailed ? createHookFailure('afterEach', afterEachError) : undefined);
                    results.failed++;
                }
                else {
                    results.passed++;
                }
                result.duration = performance.now() - startTime;
                results.tests.push(result);
            }
        }
        if (suite.afterAll) {
            let startTime = performance.now();
            try {
                await runLifecycleHooks('afterAll', suite.afterAll, undefined, undefined, true);
            }
            catch (error) {
                results.tests.push(createFailedHookResult('afterAll', suite.name, error, performance.now() - startTime));
                results.failed++;
            }
        }
    }
    // Clear suites in-place so the shared framework module is reset
    // for the next test file (which reuses the same cached module instance)
    suites.length = 0;
    if (e2eCoverageEntries.length > 0) {
        results.e2eBrowserCoverageEntries = e2eCoverageEntries;
    }
    return results;
}
function createE2EOptions(options, addE2ECoverageEntries) {
    if (options?.browser === undefined)
        return undefined;
    if (options.coverage === undefined ||
        options.open === undefined ||
        options.playwrightPageOptions === undefined) {
        throw new Error('Incomplete E2E test options');
    }
    return {
        addE2ECoverageEntries,
        browser: options.browser,
        coverage: options.coverage,
        open: options.open,
        playwrightPageOptions: options.playwrightPageOptions,
    };
}
function createTestNameMatcher(patterns) {
    if (patterns === undefined)
        return undefined;
    let regexes = patterns.map((pattern) => new RegExp(pattern.source, pattern.flags));
    return (suiteName, testName) => {
        let fullName = suiteName && testName ? `${suiteName} ${testName}` : suiteName || testName;
        return regexes.some((regex) => {
            regex.lastIndex = 0;
            return regex.test(fullName);
        });
    };
}
function getRegisteredSuites() {
    let global = globalThis;
    return global.__testSuites ?? [];
}
function getPendingStatus(value) {
    if (isPending(value.todo))
        return 'todo';
    if (isPending(value.skip))
        return 'skipped';
    return undefined;
}
function isPending(value) {
    return value === true || typeof value === 'string';
}
function getPendingReason(value, status) {
    let reason = status === 'todo' ? value.todo : value.skip;
    return typeof reason === 'string' && reason.length > 0 ? reason : undefined;
}
function createPendingResult(name, suiteName, status, reason) {
    let result = {
        name,
        suiteName,
        status,
        duration: 0,
    };
    if (reason)
        result.reason = reason;
    return result;
}
async function runLifecycleHooks(hookName, hooks, abortController, inheritedSignal, reverse = false) {
    let orderedHooks = reverse ? [...hooks].reverse() : hooks;
    for (let hook of orderedHooks) {
        await runRunnable(hookName, hook.fn, hook, abortController, inheritedSignal, hook.signal);
    }
}
async function runRunnable(label, fn, options, abortController, ...signals) {
    let timeoutId;
    let abortCleanups = [];
    let abortSignals = [...new Set([...signals, options.signal])].filter((signal) => signal != null);
    for (let signal of abortSignals) {
        if (signal.aborted) {
            let error = createAbortError(label, signal.reason);
            abortController?.abort(error);
            throw error;
        }
    }
    let abortPromise = new Promise((_, reject) => {
        for (let signal of abortSignals) {
            let onAbort = () => {
                let error = createAbortError(label, signal.reason);
                abortController?.abort(error);
                reject(error);
            };
            signal.addEventListener('abort', onAbort, { once: true });
            abortCleanups.push(() => signal.removeEventListener('abort', onAbort));
        }
    });
    let timeout = options.timeout;
    let timeoutPromise = timeout && timeout > 0
        ? new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                let error = createTimeoutError(label, timeout);
                reject(error);
                abortController?.abort(error);
            }, timeout);
        })
        : undefined;
    try {
        await Promise.race([
            Promise.resolve().then(fn),
            abortPromise,
            ...(timeoutPromise ? [timeoutPromise] : []),
        ]);
    }
    finally {
        if (timeoutId)
            clearTimeout(timeoutId);
        for (let cleanup of abortCleanups)
            cleanup();
    }
}
function createTimeoutError(label, timeout) {
    let error = new Error(`${label} timed out after ${timeout}ms`);
    error.name = 'TimeoutError';
    return error;
}
function createAbortError(label, reason) {
    let message = reason instanceof Error ? reason.message : String(reason ?? 'This operation was aborted');
    let error = new Error(`${label} aborted: ${message}`);
    error.name = 'AbortError';
    return error;
}
function createFailedHookResult(hookName, suiteName, error, duration) {
    return {
        name: hookName,
        suiteName,
        status: 'failed',
        error: createTestError(createHookFailure(hookName, error)),
        duration,
    };
}
function createHookFailure(hookName, error) {
    let cause = error instanceof Error ? error : new Error(String(error));
    return new Error(`${hookName} failed: ${cause.message}`, { cause });
}
function createTestError(primaryError, secondaryError = undefined) {
    let message = primaryError !== undefined ? getErrorMessage(primaryError) : undefined;
    let stack = primaryError instanceof Error ? primaryError.stack : undefined;
    if (secondaryError) {
        message = message ? `${message}\n${secondaryError.message}` : secondaryError.message;
        stack =
            stack && secondaryError.stack
                ? `${stack}\n${secondaryError.stack}`
                : (stack ?? secondaryError.stack);
    }
    return {
        message: message ?? 'Test failed',
        stack,
    };
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
