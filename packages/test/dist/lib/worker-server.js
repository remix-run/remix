var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import * as mod from 'node:module';
import { IS_RUNNING_FROM_SRC } from "./config.js";
import { importModule } from "./import-module.js";
import { runTests } from "./executor.js";
import { IS_BUN } from "./runtime.js";
import { createFailedResults } from "./worker-results.js";
export async function runServerTestFile(value) {
    let workerData;
    try {
        workerData = parseServerTestWorkerData(value);
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
        await takeCoverage(workerData.coverage);
        return results;
    }
    catch (e) {
        try {
            await takeCoverage(workerData?.coverage);
        }
        catch (coverageError) {
            e = coverageError;
        }
        return createFailedResults(e);
    }
}
function parseServerTestWorkerData(value) {
    if (!isRecord(value) || typeof value.file !== 'string') {
        throw new Error('Invalid server test worker data');
    }
    return {
        file: value.file,
        coverage: parseCoverageConfig(value.coverage),
    };
}
export function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
export function parseCoverageConfig(value) {
    if (value === undefined) {
        return undefined;
    }
    if (!isRecord(value) || typeof value.dir !== 'string') {
        throw new Error('Invalid server test worker coverage config');
    }
    let coverage = {
        dir: value.dir,
    };
    let include = parseStringArray(value.include, 'include');
    let exclude = parseStringArray(value.exclude, 'exclude');
    let statements = parseNumber(value.statements, 'statements');
    let lines = parseNumber(value.lines, 'lines');
    let branches = parseNumber(value.branches, 'branches');
    let functions = parseNumber(value.functions, 'functions');
    if (include)
        coverage.include = include;
    if (exclude)
        coverage.exclude = exclude;
    if (statements !== undefined)
        coverage.statements = statements;
    if (lines !== undefined)
        coverage.lines = lines;
    if (branches !== undefined)
        coverage.branches = branches;
    if (functions !== undefined)
        coverage.functions = functions;
    return coverage;
}
function parseStringArray(value, name) {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`Invalid server test worker coverage ${name}`);
    }
    return value;
}
function parseNumber(value, name) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'number') {
        throw new Error(`Invalid server test worker coverage ${name}`);
    }
    return value;
}
async function takeCoverage(coverage) {
    if (coverage && !IS_BUN) {
        let v8 = await import('node:v8');
        v8.takeCoverage();
    }
}
