import { createTestContext } from "./context.js";
export async function runTests(options) {
    let suites = getRegisteredSuites();
    let e2eCoverageEntries = [];
    let results = {
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
        tests: [],
    };
    let hasOnlySuites = suites.some((suite) => suite.only);
    for (let suite of suites) {
        // If any suite uses .only, skip all non-only suites
        if (hasOnlySuites && !suite.only) {
            for (let test of suite.tests) {
                results.tests.push({
                    name: test.name,
                    suiteName: suite.name,
                    status: 'skipped',
                    duration: 0,
                });
                results.skipped++;
            }
            continue;
        }
        if (suite.skip || suite.todo) {
            let status = suite.todo ? 'todo' : 'skipped';
            for (let test of suite.tests) {
                results.tests.push({ name: test.name, suiteName: suite.name, status, duration: 0 });
                results[status]++;
            }
            // describe.todo('name') with no tests — add placeholder so suite appears in output
            if (suite.tests.length === 0) {
                results.tests.push({ name: '', suiteName: suite.name, status, duration: 0 });
                results[status]++;
            }
            continue;
        }
        if (suite.beforeAll) {
            let startTime = performance.now();
            try {
                await suite.beforeAll();
            }
            catch (error) {
                results.tests.push(createFailedHookResult('beforeAll', suite.name, error, performance.now() - startTime));
                results.failed++;
                continue;
            }
        }
        let hasOnlyTests = suite.tests.some((test) => test.only);
        for (let test of suite.tests) {
            // If any test uses .only, skip all non-only tests in this suite
            if (hasOnlyTests && !test.only) {
                results.tests.push({
                    name: test.name,
                    suiteName: suite.name,
                    status: 'skipped',
                    duration: 0,
                });
                results.skipped++;
                continue;
            }
            if (test.skip || test.todo) {
                let status = test.todo ? 'todo' : 'skipped';
                results.tests.push({ name: test.name, suiteName: suite.name, status, duration: 0 });
                results[status]++;
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
            let contextOpts = options
                ? {
                    ...options,
                    addE2ECoverageEntries: (e) => e2eCoverageEntries.push(e),
                }
                : undefined;
            let { testContext, cleanup } = createTestContext(contextOpts);
            try {
                if (suite.beforeEach) {
                    await suite.beforeEach();
                }
                await test.fn(testContext);
            }
            catch (error) {
                testFailed = true;
                testError = error;
            }
            finally {
                await cleanup();
                if (suite.afterEach) {
                    try {
                        await suite.afterEach();
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
                await suite.afterAll();
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
function getRegisteredSuites() {
    let global = globalThis;
    return global.__testSuites ?? [];
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
