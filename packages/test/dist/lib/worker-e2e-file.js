import { runTests } from "./executor.js";
import { importModule } from "./import-module.js";
import { getBrowserLauncher, getPlaywrightLaunchOptions, getPlaywrightPageOptions, } from "./playwright.js";
import { createFailedResults } from "./worker-results.js";
import { isRecord, parseCoverageConfig } from "./worker-server.js";
export async function runE2ETestFile(value, onOpenResults) {
    try {
        let workerData = parseE2ETestWorkerData(value);
        await importModule(workerData.file, import.meta);
        let launcher = await getBrowserLauncher(workerData.playwrightUseOpts);
        let opts = getPlaywrightLaunchOptions(workerData.playwrightUseOpts);
        let browser = await launcher.launch(opts);
        let browserClosed = false;
        try {
            let results = await runTests({
                browser,
                open: workerData.open ?? false,
                playwrightPageOptions: getPlaywrightPageOptions(workerData.playwrightUseOpts),
                coverage: !!workerData.coverage,
            });
            if (workerData.open) {
                await onOpenResults?.(results);
                console.log('\nBrowser is open. Press Ctrl+C to close.');
                await new Promise((resolve) => browser.on('disconnected', () => resolve()));
                return undefined;
            }
            await browser.close();
            browserClosed = true;
            return results;
        }
        finally {
            if (!browserClosed) {
                await browser.close();
            }
        }
    }
    catch (error) {
        return createFailedResults(error);
    }
}
function parseE2ETestWorkerData(value) {
    if (!isRecord(value) || typeof value.file !== 'string') {
        throw new Error('Invalid E2E test worker data');
    }
    return {
        file: value.file,
        coverage: parseCoverageConfig(value.coverage),
        open: parseBoolean(value.open, 'open'),
        playwrightUseOpts: parsePlaywrightUseOpts(value.playwrightUseOpts),
    };
}
function parseBoolean(value, name) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'boolean') {
        throw new Error(`Invalid E2E test worker ${name}`);
    }
    return value;
}
function parsePlaywrightUseOpts(value) {
    if (value === undefined) {
        return undefined;
    }
    if (!isRecord(value)) {
        throw new Error('Invalid E2E test worker playwright options');
    }
    return value;
}
