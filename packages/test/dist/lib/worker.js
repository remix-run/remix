var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import * as mod from 'node:module';
import { runTests } from "./executor.js";
import { importModule } from "./import-module.js";
import { IS_BUN } from "./runtime.js";
import { IS_RUNNING_FROM_SRC } from "./config.js";
import { receiveWorkerData, sendResults } from "./worker-channel.js";
const workerData = await receiveWorkerData();
try {
    // When coverage is enabled in Node, we use a coverage-friendly TypeScript loader which
    // replaces tsx's minified transformation with a non-minified esbuild transform
    // so V8 coverage byte offsets align with readable source lines. This hook runs
    // before the inherited tsx hook (hooks are LIFO), so it intercepts .ts imports and
    // short-circuits before tsx transforms them.
    if (workerData.coverage && !IS_BUN) {
        // Ensure we load the right file whether we're running in the monorepo (TS) or
        // from a published package (JS)
        let ext = IS_RUNNING_FROM_SRC ? '.ts' : '.js';
        mod.register(new URL(`./coverage-loader${ext}`, import.meta.url), import.meta.url);
        await import(__rewriteRelativeImportExtension(workerData.file));
    }
    else {
        await importModule(workerData.file, import.meta);
    }
    let results = await runTests();
    sendResults(results);
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
