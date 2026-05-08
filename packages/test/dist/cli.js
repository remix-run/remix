import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { getRemixTestHelpText, IS_RUNNING_FROM_SRC, loadConfig, } from "./lib/config.js";
import { generateCombinedCoverageReport } from "./lib/coverage.js";
import { createReporter } from "./lib/reporters/index.js";
import { runServerTests } from "./lib/runner.js";
import { createWatcher } from "./lib/watcher.js";
import { importModule } from "./lib/import-module.js";
import { IS_BUN } from "./lib/runtime.js";
import { isMainThread } from 'node:worker_threads';
export { getRemixTestHelpText };
const MISSING_PLAYWRIGHT_MESSAGE = 'Playwright is required to run browser and E2E tests. Install it with `npm i -D playwright`.';
/**
 * Programmatic entry point for the `remix-test` CLI. Loads the user's
 * {@link RemixTestConfig}, discovers test files, and runs them through the
 * server/browser/E2E pipelines configured by the project. In watch mode the
 * promise resolves when the user terminates the runner; otherwise it resolves
 * once the run finishes.
 *
 * @param options Optional overrides for the parsed argv and working directory.
 * @returns The exit code the host process should use (`0` on success, `1` on
 *          test failure or unrecoverable error).
 *
 * @example
 * ```ts
 * import { runRemixTest } from '@remix-run/test/cli'
 *
 * let exitCode = await runRemixTest()
 * process.exit(exitCode)
 * ```
 */
export async function runRemixTest(options = {}) {
    let argv = options.argv ?? process.argv.slice(2);
    let cwd = await resolveCwd(options.cwd ?? process.cwd());
    let previousCwd = process.cwd();
    if (!isMainThread) {
        return await runRemixTestInCwd(argv, cwd);
    }
    try {
        process.chdir(cwd);
        return await runRemixTestInCwd(argv, cwd);
    }
    finally {
        process.chdir(previousCwd);
    }
}
async function runRemixTestInCwd(argv, cwd) {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(getRemixTestHelpText());
        return 0;
    }
    let config = await loadConfig(argv, cwd);
    let hasExited = false;
    let latestExitCode = 0;
    let watcher;
    let running = false;
    let queued = false;
    let rerunTimer;
    let browserServer;
    let browserServerFilesKey;
    let browserPort;
    let resolveRun;
    let runPromise = new Promise((resolve) => {
        resolveRun = resolve;
    });
    let cleanupAndExit = (code) => {
        if (hasExited)
            return;
        hasExited = true;
        watcher?.close();
        browserServer?.close();
        clearTimeout(rerunTimer);
        process.off('SIGINT', handleInterrupt);
        process.off('SIGTERM', handleInterrupt);
        resolveRun?.(code);
    };
    let handleInterrupt = () => cleanupAndExit(latestExitCode);
    let closeBrowserServer = async () => {
        if (!browserServer)
            return;
        let server = browserServer;
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        browserServer = undefined;
        browserServerFilesKey = undefined;
        browserPort = undefined;
    };
    let queueRerun = (reason) => {
        if (!config.watch || hasExited)
            return;
        clearTimeout(rerunTimer);
        rerunTimer = setTimeout(() => {
            rerunTimer = undefined;
            if (running) {
                queued = true;
            }
            else {
                console.log(`\n↻ Change detected (${reason}), re-running tests...\n`);
                void executeRun();
            }
        }, 100);
    };
    let executeRun = async () => {
        if (hasExited)
            return;
        running = true;
        let globalTeardown;
        try {
            if (config.setup) {
                let mod = await importModule(path.resolve(cwd, config.setup), import.meta);
                let globalSetup = mod.globalSetup;
                globalTeardown = mod.globalTeardown;
                await globalSetup?.();
            }
            let discoveredTests = await discoverTests(config, cwd);
            if (discoveredTests == null) {
                latestExitCode = 1;
                cleanupAndExit(latestExitCode);
                return;
            }
            let { files, serverFiles, browserFiles, e2eFiles } = discoveredTests;
            if (config.watch) {
                watcher ??= createWatcher((file) => queueRerun(file));
                watcher.update(files);
            }
            let browserFilesKey = browserFiles.join('\0');
            if (browserServer && browserFiles.length === 0) {
                await closeBrowserServer();
            }
            else if (browserFiles.length > 0 &&
                (!browserServer || browserServerFilesKey !== browserFilesKey)) {
                await closeBrowserServer();
                let { startServer } = IS_RUNNING_FROM_SRC
                    ? await importModule('./app/server.ts', import.meta)
                    : await import(`./app/server.js`);
                let result = await startServer(browserFiles);
                browserServer = result.server;
                browserServerFilesKey = browserFilesKey;
                browserPort = result.port;
            }
            let reporter = createReporter(config.reporter);
            let startTime = performance.now();
            let counts = {
                passed: 0,
                failed: 0,
                skipped: 0,
                todo: 0,
            };
            let allCoverageMaps = [];
            if (serverFiles.length > 0) {
                reporter.onSectionStart('\nRunning server tests:');
                let serverResult = await runServerTests(serverFiles, reporter, config.concurrency, 'server', {
                    coverage: config.coverage,
                    cwd,
                    pool: config.pool,
                });
                counts.failed += serverResult.failed;
                counts.passed += serverResult.passed;
                counts.skipped += serverResult.skipped;
                counts.todo += serverResult.todo;
                allCoverageMaps.push(serverResult.coverageMap);
            }
            // Run browser/e2e tests for all browsers configured by the user
            if (browserFiles.length > 0 || e2eFiles.length > 0) {
                let { loadPlaywrightConfig, resolveProjects } = await importPlaywrightSupport();
                let runBrowserTests = browserFiles.length > 0 ? (await importBrowserTestRunner()).runBrowserTests : undefined;
                let playwrightConfig = config.playwrightConfig == null || typeof config.playwrightConfig === 'string'
                    ? await loadPlaywrightConfig(config.playwrightConfig, cwd)
                    : config.playwrightConfig;
                let projects = resolveProjects(playwrightConfig);
                if (config.project) {
                    let projectNames = new Set(config.project);
                    projects = projects.filter((project) => project.name && projectNames.has(project.name));
                    if (projects.length === 0) {
                        throw new Error(`No playwright projects found with name(s) "${config.project.join(', ')}"`);
                    }
                }
                let lastBrowserResult = null;
                for (let project of projects) {
                    reporter.onSectionStart(`\nRunning tests for project \`${project.name}\`:`);
                    if (config.browser?.open) {
                        if (project.playwrightUseOpts?.headless === true) {
                            let label = project.name ? ` (project "${project.name}")` : '';
                            console.warn(`Warning: browser.open is set but playwright headless is explicitly true${label} — ignoring browser.open`);
                        }
                        else {
                            project.playwrightUseOpts = { ...project.playwrightUseOpts, headless: false };
                        }
                    }
                    let [browserResult, e2eResult] = await Promise.all([
                        runBrowserTests != null
                            ? runBrowserTests({
                                baseUrl: `http://localhost:${browserPort}`,
                                console: config.browser?.echo,
                                coverage: !!config.coverage,
                                open: config.browser?.open,
                                playwrightUseOpts: project.playwrightUseOpts,
                                projectName: project.name,
                                reporter,
                                testFiles: browserFiles,
                            })
                            : null,
                        e2eFiles.length > 0
                            ? runServerTests(e2eFiles, reporter, config.concurrency, 'e2e', {
                                open: config.browser?.open,
                                playwrightUseOpts: project.playwrightUseOpts,
                                projectName: project.name,
                                coverage: config.coverage,
                                cwd,
                                pool: config.pool,
                            })
                            : null,
                    ]);
                    counts.passed += (browserResult?.results.passed ?? 0) + (e2eResult?.passed ?? 0);
                    counts.failed += (browserResult?.results.failed ?? 0) + (e2eResult?.failed ?? 0);
                    counts.skipped += (browserResult?.results.skipped ?? 0) + (e2eResult?.skipped ?? 0);
                    counts.todo += (browserResult?.results.todo ?? 0) + (e2eResult?.todo ?? 0);
                    allCoverageMaps.push(browserResult?.coverageMap);
                    allCoverageMaps.push(e2eResult?.coverageMap);
                    if (browserResult) {
                        lastBrowserResult = browserResult;
                    }
                }
                if (config.browser?.open && lastBrowserResult) {
                    console.log('\nBrowser is open. Press Ctrl+C to close.');
                    await Promise.race([
                        lastBrowserResult.disconnected,
                        new Promise((resolve) => {
                            process.once('SIGINT', resolve);
                            process.once('SIGTERM', resolve);
                        }),
                    ]);
                    await lastBrowserResult.close();
                }
            }
            reporter.onSummary(counts, performance.now() - startTime);
            let thresholdsPassed = true;
            if (config.coverage) {
                thresholdsPassed = await generateCombinedCoverageReport(allCoverageMaps, cwd, config.coverage);
            }
            latestExitCode = counts.failed > 0 || !thresholdsPassed ? 1 : 0;
        }
        catch (error) {
            console.error('Error running tests:', error);
            latestExitCode = 1;
        }
        finally {
            await globalTeardown?.();
            running = false;
            if (queued) {
                queued = false;
                queueRerun('queued change');
            }
            else if (!config.watch) {
                cleanupAndExit(latestExitCode);
            }
        }
    };
    process.on('SIGINT', handleInterrupt);
    process.on('SIGTERM', handleInterrupt);
    try {
        await executeRun();
        if (config.watch && !hasExited) {
            console.log('Watching for changes. Press Ctrl+C to stop.');
        }
    }
    catch {
        cleanupAndExit(1);
    }
    return await runPromise;
}
async function importPlaywrightSupport() {
    try {
        return await import("./lib/playwright.js");
    }
    catch (error) {
        throw toPlaywrightImportError(error);
    }
}
async function importBrowserTestRunner() {
    try {
        return await import("./lib/runner-browser.js");
    }
    catch (error) {
        throw toPlaywrightImportError(error);
    }
}
function toPlaywrightImportError(error) {
    return isMissingPlaywrightImport(error) ? new Error(MISSING_PLAYWRIGHT_MESSAGE) : error;
}
function isMissingPlaywrightImport(error) {
    if (!isRecord(error) || typeof error.message !== 'string') {
        return false;
    }
    return ((error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') &&
        (error.message.includes("Cannot find package 'playwright'") ||
            error.message.includes("Cannot find module 'playwright'")));
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
async function resolveCwd(cwd) {
    try {
        return await fsp.realpath(cwd);
    }
    catch {
        return path.resolve(cwd);
    }
}
async function discoverTests(config, cwd) {
    let files = await findFiles(config.glob.test, config.glob.exclude, cwd);
    if (files.length === 0) {
        console.log(`No test files found matching pattern: ${config.glob.test.join(', ')}`);
        return null;
    }
    let browserSet = new Set(await findFiles(config.glob.browser, config.glob.exclude, cwd));
    let e2eSet = new Set(await findFiles(config.glob.e2e, config.glob.exclude, cwd));
    let types = new Set(config.type);
    let browserFiles = types.has('browser') ? files.filter((f) => browserSet.has(f)) : [];
    let e2eFiles = types.has('e2e') ? files.filter((file) => e2eSet.has(file)) : [];
    let serverFiles = types.has('server')
        ? files.filter((file) => !browserSet.has(file) && !e2eSet.has(file))
        : [];
    let totalFiles = browserFiles.length + serverFiles.length + e2eFiles.length;
    if (totalFiles === 0) {
        console.log(`No test files remain after filtering for type ${config.type.join(', ')}`);
        return null;
    }
    console.log(`Found ${totalFiles} test file(s) (${serverFiles.length} server, ${browserFiles.length} browser, ${e2eFiles.length} e2e)`);
    return {
        files,
        serverFiles,
        browserFiles,
        e2eFiles,
    };
}
async function findFiles(patterns, excludePatterns, cwd) {
    let files = new Set();
    if (IS_BUN) {
        // Bun's `fs.promises.glob` follows symlinks and doesn't prune traversal
        // via `exclude`, so it enters pnpm symlink cycles in `node_modules`.
        // Use Bun's native Glob, which defaults to `followSymlinks: false`.
        // @ts-expect-error — bun module is only resolvable under the Bun runtime
        let { Glob } = await import('bun');
        let excludeGlobs = excludePatterns.map((p) => new Glob(p));
        for (let pattern of patterns) {
            let glob = new Glob(pattern);
            for await (let file of glob.scan({ cwd, absolute: true })) {
                let rel = toPosix(path.relative(cwd, file));
                if (!excludeGlobs.some((eg) => eg.match(rel))) {
                    files.add(toPosix(file));
                }
            }
        }
        return [...files];
    }
    for (let pattern of patterns) {
        for await (let file of fsp.glob(pattern, { cwd, exclude: excludePatterns })) {
            files.add(toPosix(path.resolve(cwd, file)));
        }
    }
    return [...files];
}
// Normalize discovered paths so set membership across the test/browser/e2e
// `findFiles` calls is byte-stable on every platform. Node accepts forward
// slashes for filesystem operations on Windows, so downstream `fs.readFile`
// etc. work without further conversion.
function toPosix(p) {
    return path.sep === '/' ? p : p.replace(/\\/g, '/');
}
