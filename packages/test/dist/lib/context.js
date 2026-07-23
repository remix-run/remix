import { createFakeTimers } from "./fake-timers.js";
import { mock } from "./mock.js";
export function createTestContext(options) {
    let cleanups = [];
    let testContext = {
        signal: options?.signal ?? new AbortController().signal,
        mock: {
            fn: mock.fn,
            method(obj, methodName, impl) {
                let mockFn = mock.method(obj, methodName, impl);
                if (mockFn.mock.restore)
                    cleanups.push(mockFn.mock.restore);
                return mockFn;
            },
        },
        after(fn) {
            cleanups.push(fn);
        },
        useFakeTimers() {
            let timers = createFakeTimers();
            cleanups.push(timers.restore);
            return timers;
        },
        async serve(server) {
            let e2e = options?.e2e;
            if (!e2e) {
                throw new Error('t.serve() is only available in E2E test suites');
            }
            let page = await e2e.browser.newPage({
                ...e2e.playwrightPageOptions,
                baseURL: server.baseUrl,
            });
            if (e2e.playwrightPageOptions?.navigationTimeout != null) {
                page.setDefaultNavigationTimeout(e2e.playwrightPageOptions.navigationTimeout);
            }
            if (e2e.playwrightPageOptions?.actionTimeout != null) {
                page.setDefaultTimeout(e2e.playwrightPageOptions.actionTimeout);
            }
            let coverageEnabled = e2e.coverage && e2e.browser.browserType().name() === 'chromium';
            if (coverageEnabled) {
                await page.coverage.startJSCoverage({ resetOnNavigation: false });
                cleanups.push(async () => {
                    let entries = await page.coverage.stopJSCoverage();
                    e2e.addE2ECoverageEntries?.({
                        entries: entries,
                        baseUrl: server.baseUrl,
                    });
                });
            }
            cleanups.push(async () => {
                if (!e2e.open) {
                    await page.close();
                }
                await server.close();
            });
            return page;
        },
    };
    return {
        testContext,
        async cleanup() {
            for (let fn of cleanups)
                await fn();
            cleanups.length = 0;
        },
    };
}
