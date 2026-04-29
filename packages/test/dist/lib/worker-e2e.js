import { runTests } from "./executor.js";
import { importModule } from "./import-module.js";
import { getBrowserLauncher, getPlaywrightLaunchOptions, getPlaywrightPageOptions, } from "./playwright.js";
import { receiveWorkerData, sendResults } from "./worker-channel.js";
const workerData = await receiveWorkerData();
try {
    await importModule(workerData.file, import.meta);
    let launcher = await getBrowserLauncher(workerData.playwrightUseOpts);
    let opts = getPlaywrightLaunchOptions(workerData.playwrightUseOpts);
    let browser = await launcher.launch(opts);
    try {
        let results = await runTests({
            browser,
            open: workerData.open ?? false,
            playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
            coverage: workerData.coverage,
        });
        sendResults(results);
        if (workerData.open) {
            console.log('\nBrowser is open. Press Ctrl+C to close.');
            await new Promise((resolve) => browser.on('disconnected', () => resolve()));
        }
    }
    finally {
        await browser.close();
    }
    process.exit(0);
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
    sendResults(results);
    process.exit(0);
}
