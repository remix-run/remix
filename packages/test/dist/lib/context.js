import { mock } from "./mock.js";
export function createTestContext(options) {
    let cleanups = [];
    let testContext = {
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
        async serve(handler) {
            if (!options.createServer || !options.browser) {
                throw new Error('t.serve() is only available in E2E test suites');
            }
            let server = await options.createServer(handler);
            let page = await options.browser.newPage({
                ...options.playwrightPageOptions,
                baseURL: server.baseUrl,
            });
            if (options.playwrightPageOptions?.navigationTimeout != null) {
                page.setDefaultNavigationTimeout(options.playwrightPageOptions.navigationTimeout);
            }
            if (options.playwrightPageOptions?.actionTimeout != null) {
                page.setDefaultTimeout(options.playwrightPageOptions.actionTimeout);
            }
            let coverageEnabled = options.coverage && options.browser.browserType().name() === 'chromium';
            if (coverageEnabled) {
                await page.coverage.startJSCoverage({ resetOnNavigation: false });
                cleanups.push(async () => {
                    let entries = await page.coverage.stopJSCoverage();
                    options.addE2ECoverageEntries?.({
                        entries: entries,
                        baseUrl: server.baseUrl,
                    });
                });
            }
            cleanups.push(async () => {
                if (!options.open) {
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
