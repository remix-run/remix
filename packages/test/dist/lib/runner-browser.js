import * as path from 'node:path';
import { colors } from "./colors.js";
import { getBrowserTestRootDir } from "./config.js";
import { collectCoverageMapFromPlaywright, } from "./coverage.js";
import { getBrowserLauncher, getPlaywrightLaunchOptions, getPlaywrightPageOptions, } from "./playwright.js";
// The harness reports each test result with `filePath` set to the
// `/scripts/<rel>` URL the iframe loaded. Reporters expect a real filesystem
// path so they can compute `path.relative(cwd, ...)` cleanly; otherwise they
// produce noisy `../../../scripts/...` strings.
function urlPathToFilePath(urlPath, rootDir) {
    if (!urlPath.startsWith('/scripts/'))
        return urlPath;
    return path.resolve(rootDir, urlPath.slice('/scripts/'.length));
}
export async function runBrowserTests(options) {
    let envLabel = options.projectName ? `browser:${options.projectName}` : 'browser';
    let browser;
    let page;
    let close = async () => {
        await page?.close();
        await browser?.close();
        browser = undefined;
        page = undefined;
    };
    let results;
    let coverageMap = null;
    try {
        browser = await getBrowserLauncher(options.playwrightUseOpts).launch(getPlaywrightLaunchOptions(options.playwrightUseOpts));
        page = await browser.newPage(getPlaywrightPageOptions(options.playwrightUseOpts));
        // Cap how long we'll wait for a browser-test file to signal completion.
        // Playwright's default is 30s; bumping to 60s buys headroom for slower
        // suites without letting a hung test hide forever. Plumb this through
        // config later if anyone needs to tune it.
        page.setDefaultTimeout(60_000);
        page.setDefaultNavigationTimeout(60_000);
        if (options.console) {
            page.on('console', (msg) => console.log(`${colors.dim('[browser console]')} ${msg.text()}`));
        }
        // Playwright's JS coverage is Chromium-only. Start before navigation so
        // the harness scripts and test modules are instrumented from first parse.
        let coverageEnabled = options.coverage && browser.browserType().name() === 'chromium';
        if (coverageEnabled) {
            await page.coverage.startJSCoverage({ resetOnNavigation: false });
        }
        let totalPassed = 0;
        let totalFailed = 0;
        let totalSkipped = 0;
        let totalTodo = 0;
        let rootDir = getBrowserTestRootDir();
        await page.route('**/file-results', async (route) => {
            let results = route.request().postDataJSON();
            for (let test of results.tests) {
                if (test.filePath)
                    test.filePath = urlPathToFilePath(test.filePath, rootDir);
            }
            options.reporter.onResult(results, envLabel);
            totalPassed += results.passed;
            totalFailed += results.failed;
            totalSkipped += results.skipped;
            totalTodo += results.todo;
            await route.fulfill({ status: 200 });
        });
        // Fail the tests if any /scripts/ request fails (harness scripts, test
        // modules, or their transitive imports — all served via the same prefix).
        let errorPromise = new Promise((_, reject) => {
            let isScriptRequest = (request) => new URL(request.url()).pathname.startsWith('/scripts/');
            page.on('response', (response) => {
                if (!response.ok() && isScriptRequest(response.request())) {
                    reject(new Error(`Failed to load script: ${response.request().url()}`));
                }
            });
            page.on('requestfailed', (request) => {
                if (isScriptRequest(request)) {
                    reject(new Error(`Failed to load script: ${request.url()}`));
                }
            });
        });
        // Prevent unhandled rejection if we fail before setting up the listener
        errorPromise.catch(() => { });
        await page.goto(options.baseUrl);
        await Promise.race([page.waitForFunction('window.__testsDone'), errorPromise]);
        if (coverageEnabled) {
            let entries = (await page.coverage.stopJSCoverage());
            if (entries.length > 0) {
                coverageMap = await collectCoverageMapFromPlaywright(entries, getBrowserTestRootDir(), new Set(options.testFiles ?? []), async (urlPath) => urlPath.startsWith('/scripts/') ? urlPath.slice('/scripts/'.length) : null);
            }
        }
        results = {
            passed: totalPassed,
            failed: totalFailed,
            skipped: totalSkipped,
            todo: totalTodo,
            tests: [],
        };
    }
    catch (error) {
        console.error('Browser tests failed to run:', error);
        results = {
            passed: 0,
            failed: 1,
            skipped: 0,
            todo: 0,
            tests: [],
        };
    }
    if (options.open) {
        return {
            results,
            coverageMap,
            close,
            disconnected: new Promise((r) => browser.on('disconnected', () => r())),
        };
    }
    else {
        await close();
        return {
            results,
            coverageMap,
            close,
            disconnected: Promise.resolve(),
        };
    }
}
