import { fork } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { IS_RUNNING_FROM_SRC } from "./config.js";
import { collectCoverageMapFromPlaywright, collectServerCoverageMap, } from "./coverage.js";
import {} from "./playwright.js";
// Ensure we load the right file whether we're running in the monorepo (TS) or
// from a published package (JS)
const ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js';
const workerUrl = new URL(`./worker${ext}`, import.meta.url);
const workerE2EUrl = new URL(`./worker-e2e${ext}`, import.meta.url);
const workerProcessUrl = new URL(`./worker-process${ext}`, import.meta.url);
const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 10_000;
export async function runServerTests(files, reporter, concurrency, type, options = {}) {
    let counts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
    let coverageMap = null;
    let cwd = options.cwd ?? process.cwd();
    let envLabel = options.projectName ? `${type}:${options.projectName}` : type;
    let pool = options.pool ?? 'forks';
    function accumulate(results, file) {
        reporter.onResult({ ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) }, envLabel);
        counts.passed += results.passed;
        counts.failed += results.failed;
        counts.skipped += results.skipped;
        counts.todo += results.todo;
    }
    if (type === 'e2e') {
        let allBrowserCoverageEntries = [];
        await runInConcurrentWorkers(files, concurrency, (file) => runFileInPool(file, type, (results) => {
            accumulate(results, file);
            if (results.e2eBrowserCoverageEntries) {
                allBrowserCoverageEntries.push(...results.e2eBrowserCoverageEntries);
            }
        }, {
            ...options,
            pool,
            playwrightUseOpts: options.playwrightUseOpts,
        }), () => counts.failed++, !options.open, options.workerShutdownTimeoutMs ?? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS);
        if (options.coverage && allBrowserCoverageEntries.length > 0) {
            coverageMap = await collectCoverageMapFromPlaywright(allBrowserCoverageEntries.flatMap((e) => e.entries), cwd, new Set(files), async (urlPath) => (urlPath.startsWith('/') ? urlPath.slice(1) : urlPath));
        }
    }
    else {
        let coverageDataDir;
        if (options.coverage) {
            coverageDataDir = path.resolve(cwd, options.coverage.dir);
            await fsp.mkdir(coverageDataDir, { recursive: true });
            process.env.NODE_V8_COVERAGE = coverageDataDir;
        }
        await runInConcurrentWorkers(files, concurrency, (file) => runFileInPool(file, type, (results) => accumulate(results, file), {
            ...options,
            pool,
        }), () => counts.failed++, true, options.workerShutdownTimeoutMs ?? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS);
        if (coverageDataDir) {
            delete process.env.NODE_V8_COVERAGE;
            let serverMap = await collectServerCoverageMap(coverageDataDir, cwd, new Set(files));
            coverageMap = serverMap;
        }
    }
    return { ...counts, coverageMap };
}
async function runInConcurrentWorkers(files, concurrency, runFile, onError, terminateWhenFinished, workerShutdownTimeoutMs) {
    let index = 0;
    let active = 0;
    await new Promise((resolve) => {
        function dispatch() {
            while (active < concurrency && index < files.length) {
                let file = files[index];
                index++;
                active++;
                let run = runFile(file);
                function complete() {
                    active--;
                    if (index < files.length) {
                        dispatch();
                    }
                    else if (active === 0) {
                        resolve();
                    }
                }
                run.finished.then(async () => {
                    try {
                        if (terminateWhenFinished) {
                            let exited = await waitForWorkerExit(run.exited, workerShutdownTimeoutMs);
                            if (!exited) {
                                let terminated = await run.terminate();
                                if (!terminated) {
                                    onError();
                                }
                            }
                        }
                    }
                    finally {
                        complete();
                    }
                }, async (err) => {
                    try {
                        console.error(`Error running ${file}:`, err instanceof Error ? err.message : err);
                        console.error(err);
                        onError();
                        await run.terminate();
                    }
                    finally {
                        complete();
                    }
                });
            }
            if (index >= files.length && active === 0)
                resolve();
        }
        dispatch();
    });
}
function waitForWorkerExit(exited, timeoutMs) {
    return new Promise((resolve) => {
        let timeout = setTimeout(() => resolve(false), timeoutMs);
        exited.then(() => {
            clearTimeout(timeout);
            resolve(true);
        });
    });
}
function runFileInPool(file, type, onResults, options) {
    return options.pool === 'threads'
        ? runFileInWorker(file, type, onResults, options)
        : runFileInProcess(file, type, onResults, options);
}
export function runFileInWorker(file, type, onResults, options = {}) {
    let receivedResults = false;
    let worker = type === 'e2e'
        ? new Worker(workerE2EUrl, {
            workerData: {
                file: pathToFileURL(file).href,
                type,
                coverage: options.coverage,
                open: options.open,
                playwrightUseOpts: options.playwrightUseOpts,
            },
        })
        : new Worker(workerUrl, {
            workerData: {
                file: pathToFileURL(file).href,
                type,
                coverage: options.coverage,
            },
        });
    let exited = new Promise((resolve) => {
        worker.once('exit', (code) => resolve(code));
    });
    let finished = new Promise((resolve, reject) => {
        worker.once('message', (msg) => {
            receivedResults = true;
            try {
                onResults(msg);
            }
            catch (error) {
                reject(error);
                return;
            }
            if (!options.open) {
                resolve();
            }
        });
        worker.once('error', reject);
        exited.then((code) => {
            if (receivedResults || code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Worker exited with code ${code}`));
            }
        });
    });
    return {
        finished,
        exited,
        async terminate() {
            try {
                await worker.terminate();
                return true;
            }
            catch (err) {
                console.error(`Error terminating worker for ${file}:`, err instanceof Error ? err.message : err);
                console.error(err);
                return false;
            }
        },
    };
}
function runFileInProcess(file, type, onResults, options = {}) {
    let receivedResults = false;
    let child = fork(fileURLToPath(workerProcessUrl), [], {
        serialization: 'advanced',
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    let exited = new Promise((resolve) => {
        child.once('exit', (code) => resolve(code));
    });
    let finished = new Promise((resolve, reject) => {
        child.once('message', (msg) => {
            if (!isTestResults(msg)) {
                reject(new Error('Test worker process sent invalid results'));
                return;
            }
            receivedResults = true;
            try {
                onResults(msg);
            }
            catch (error) {
                reject(error);
                return;
            }
            if (!options.open) {
                resolve();
            }
        });
        child.once('error', reject);
        exited.then((code) => {
            if (receivedResults || code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Worker process exited with code ${code}`));
            }
        });
        child.send({
            file: pathToFileURL(file).href,
            type,
            coverage: options.coverage,
            open: options.open,
            playwrightUseOpts: options.playwrightUseOpts,
        }, (error) => {
            if (error) {
                reject(error);
            }
        });
    });
    return {
        finished,
        exited,
        terminate: () => terminateChildProcess(child, exited),
    };
}
async function terminateChildProcess(child, exited) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return true;
    }
    if (!child.kill()) {
        return false;
    }
    return await waitForWorkerExit(exited, 5_000);
}
function isTestResults(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.passed === 'number' &&
        typeof value.failed === 'number' &&
        typeof value.skipped === 'number' &&
        typeof value.todo === 'number' &&
        Array.isArray(value.tests));
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
