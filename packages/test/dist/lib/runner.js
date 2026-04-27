import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { collectE2ECoverageMap, collectServerCoverageMap, } from "./coverage.js";
import {} from "./playwright.js";
// Ensure we load the right file whether we're running in the monorepo (TS) or
// from a published package (JS)
const ext = path.extname(import.meta.url);
const workerUrl = new URL(`./worker${ext}`, import.meta.url);
const workerE2EUrl = new URL(`./worker-e2e${ext}`, import.meta.url);
export async function runServerTests(files, reporter, concurrency, type, options = {}) {
    let counts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
    let coverageMap = null;
    let envLabel = options.projectName ? `${type}:${options.projectName}` : type;
    function accumulate(results, file) {
        reporter.onResult({ ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) }, envLabel);
        counts.passed += results.passed;
        counts.failed += results.failed;
        counts.skipped += results.skipped;
        counts.todo += results.todo;
    }
    if (type === 'e2e') {
        let allBrowserCoverageEntries = [];
        await runInConcurrentWorkers(files, concurrency, (file) => runFileInWorker(file, type, (results) => {
            accumulate(results, file);
            if (results.e2eBrowserCoverageEntries) {
                allBrowserCoverageEntries.push(...results.e2eBrowserCoverageEntries);
            }
        }, {
            ...options,
            playwrightUseOpts: options.playwrightUseOpts,
        }), () => counts.failed++);
        if (options.coverage && allBrowserCoverageEntries.length > 0) {
            coverageMap = await collectE2ECoverageMap(allBrowserCoverageEntries, process.cwd(), new Set(files));
        }
    }
    else {
        let coverageDataDir;
        if (options.coverage) {
            coverageDataDir = path.resolve(options.coverage.dir);
            await fsp.mkdir(coverageDataDir, { recursive: true });
            process.env.NODE_V8_COVERAGE = coverageDataDir;
        }
        await runInConcurrentWorkers(files, concurrency, (file) => runFileInWorker(file, type, (results) => accumulate(results, file), options), () => counts.failed++);
        if (coverageDataDir) {
            delete process.env.NODE_V8_COVERAGE;
            let serverMap = await collectServerCoverageMap(coverageDataDir, process.cwd(), new Set(files));
            coverageMap = serverMap;
        }
    }
    return { ...counts, coverageMap };
}
async function runInConcurrentWorkers(files, concurrency, runFile, onError) {
    let index = 0;
    let active = 0;
    await new Promise((resolve) => {
        function dispatch() {
            while (active < concurrency && index < files.length) {
                let file = files[index];
                index++;
                active++;
                runFile(file).then(() => {
                    active--;
                    if (index < files.length) {
                        dispatch();
                    }
                    else if (active === 0) {
                        resolve();
                    }
                }, (err) => {
                    console.error(`Error running ${file}:`, err.message);
                    console.error(err);
                    onError();
                    active--;
                    if (active === 0 && index >= files.length)
                        resolve();
                    else
                        dispatch();
                });
            }
            if (index >= files.length && active === 0)
                resolve();
        }
        dispatch();
    });
}
function runFileInWorker(file, type, onResults, options = {}) {
    return new Promise((resolve, reject) => {
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
        worker.once('message', (msg) => onResults(msg));
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker exited with code ${code}`));
            else
                resolve();
        });
    });
}
