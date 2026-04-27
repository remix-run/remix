import { workerData, parentPort } from 'node:worker_threads';
import { createServer } from "./e2e-server.js";
import { runTests } from "./executor.js";
import { importModule } from "./import-module.js";
import { getBrowserLauncher, getPlaywrightLaunchOptions, getPlaywrightPageOptions, } from "./playwright.js";
try {
    await importModule(workerData.file, import.meta);
    let launcher = await getBrowserLauncher(workerData.playwrightUseOpts);
    let opts = getPlaywrightLaunchOptions(workerData.playwrightUseOpts);
    let browser = await launcher.launch(opts);
    try {
        let results = await runTests({
            browser,
            createServer,
            open: workerData.open,
            playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
            coverage: workerData.coverage,
        });
        parentPort.postMessage(results);
        if (workerData.open) {
            console.log('\nBrowser is open. Press Ctrl+C to close.');
            await new Promise((resolve) => browser.on('disconnected', () => resolve()));
        }
    }
    finally {
        await browser.close();
    }
}
catch (e) {
    let results = {
        passed: 0,
        failed: 1,
        skipped: 0,
        todo: 0,
        tests: [
            {
                name: '',
                suiteName: '',
                status: 'failed',
                duration: 0,
                error: {
                    message: e instanceof Error ? e.message : String(e),
                    stack: e instanceof Error ? e.stack : undefined,
                },
            },
        ],
    };
    parentPort.postMessage(results);
}
