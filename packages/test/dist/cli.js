#!/usr/bin/env node
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { runServerTests } from "./lib/runner.js";
import { createReporter } from "./lib/reporter.js";
import { createWatcher } from "./lib/watcher.js";
import { loadConfig } from "./lib/config.js";
const config = await loadConfig();
let hasExited = false;
let latestExitCode = 0;
let watcher;
let running = false;
let queued = false;
let rerunTimer;
process.on('SIGINT', () => cleanupAndExit(latestExitCode));
process.on('SIGTERM', () => cleanupAndExit(latestExitCode));
try {
    await executeRun();
    if (config.watch) {
        console.log('Watching for changes. Press Ctrl+C to stop.');
    }
}
catch {
    cleanupAndExit(1);
}
async function executeRun() {
    if (hasExited)
        return;
    running = true;
    let globalTeardown;
    try {
        if (config.setup) {
            let mod = await tsImport(path.resolve(process.cwd(), config.setup), {
                parentURL: import.meta.url,
            });
            let globalSetup = mod.globalSetup;
            globalTeardown = mod.globalTeardown;
            await globalSetup?.();
        }
        let { files, serverFiles } = await discoverTests(config);
        if (config.watch) {
            watcher ??= createWatcher((file) => queueRerun(file));
            watcher.update(files);
        }
        let reporter = createReporter(config.reporter);
        let startTime = performance.now();
        let counts = {
            passed: 0,
            failed: 0,
            skipped: 0,
            todo: 0,
        };
        // Run server tests
        if (serverFiles.length > 0) {
            reporter.onSectionStart('\nRunning server tests:');
            let serverResult = await runServerTests(serverFiles, reporter, config.concurrency, 'server');
            counts.failed += serverResult.failed;
            counts.passed += serverResult.passed;
            counts.skipped += serverResult.skipped;
            counts.todo += serverResult.todo;
        }
        reporter.onSummary(counts, performance.now() - startTime);
        latestExitCode = counts.failed > 0 ? 1 : 0;
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
}
async function discoverTests(config) {
    async function findFiles(pattern) {
        let files = [];
        let exclude = ['node_modules/**', '.git/**'];
        for await (let file of fsp.glob(pattern, { cwd: process.cwd(), exclude })) {
            files.push(path.resolve(process.cwd(), file));
        }
        return files;
    }
    let files = await findFiles(config.glob.test);
    if (files.length === 0) {
        console.log(`No test files found matching pattern: ${config.glob.test}`);
        process.exit(1);
    }
    let serverFiles = files;
    let totalFiles = serverFiles.length;
    console.log(`Found ${totalFiles} test file(s) (${serverFiles.length} server)`);
    return {
        files,
        serverFiles,
    };
}
function queueRerun(reason) {
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
}
function cleanupAndExit(code) {
    if (hasExited)
        return;
    hasExited = true;
    watcher?.close();
    process.exit(code);
}
