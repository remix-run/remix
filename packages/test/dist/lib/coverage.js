import * as fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { colors } from "./colors.js";
import { transformTypeScript } from "./ts-transform.js";
// Istanbul packages are loaded lazily so that FORCE_COLOR can be set based on
// the actual TTY state before supports-color caches its detection result.
let _istanbul;
function getIstanbul() {
    if (!_istanbul) {
        process.env.FORCE_COLOR ??= process.stdout.isTTY ? '1' : '0';
        let require = createRequire(import.meta.url);
        _istanbul = {
            V8ToIstanbul: require('v8-to-istanbul'),
            createCoverageMap: require('istanbul-lib-coverage').createCoverageMap,
            createContext: require('istanbul-lib-report')
                .createContext,
            reports: require('istanbul-reports'),
        };
    }
    return _istanbul;
}
function matchesGlobs(filePath, globs) {
    return globs.some((glob) => path.matchesGlob(filePath, glob));
}
function filterCoverageMap(coverageMap, cwd, config) {
    let filtered = getIstanbul().createCoverageMap({});
    for (let filePath of coverageMap.files()) {
        let relative = path.relative(cwd, filePath);
        if (config.include && config.include.length > 0) {
            if (!matchesGlobs(relative, config.include))
                continue;
        }
        if (config.exclude && config.exclude.length > 0) {
            if (matchesGlobs(relative, config.exclude))
                continue;
        }
        let fc = coverageMap.fileCoverageFor(filePath);
        filtered.addFileCoverage({ ...fc.toJSON(), path: relative });
    }
    return filtered;
}
function checkThresholds(coverageMap, config) {
    let { statements, lines, branches, functions } = config;
    if (statements === undefined &&
        lines === undefined &&
        branches === undefined &&
        functions === undefined)
        return true;
    let summary = coverageMap.getCoverageSummary();
    let passed = true;
    if (statements !== undefined) {
        let pct = summary.statements.pct;
        if (pct < statements) {
            console.error(colors.red(`\nError: Coverage threshold not met (statements ${pct.toFixed(2)}% < ${statements}%)`));
            passed = false;
        }
    }
    if (lines !== undefined) {
        let pct = summary.lines.pct;
        if (pct < lines) {
            console.error(colors.red(`\nError: Coverage threshold not met (lines ${pct.toFixed(2)}% < ${lines}%)`));
            passed = false;
        }
    }
    if (branches !== undefined) {
        let pct = summary.branches.pct;
        if (pct < branches) {
            console.error(colors.red(`\nError: Coverage threshold not met (branches ${pct.toFixed(2)}% < ${branches}%)`));
            passed = false;
        }
    }
    if (functions !== undefined) {
        let pct = summary.functions.pct;
        if (pct < functions) {
            console.error(colors.red(`\nError: Coverage threshold not met (functions ${pct.toFixed(2)}% < ${functions}%)`));
            passed = false;
        }
    }
    return passed;
}
async function writeIstanbulReports(coverageMap, cwd, outDir) {
    await fsp.mkdir(outDir, { recursive: true });
    let { createContext, reports } = getIstanbul();
    let ctx = createContext({ coverageMap, dir: outDir });
    console.log('\nCoverage report:');
    reports.create('text').execute(ctx);
    reports.create('lcovonly').execute(ctx);
    console.log(`\nLCOV coverage written to ${path.relative(cwd, path.join(outDir, 'lcov.info'))}`);
}
// Convert a single V8 coverage entry to Istanbul format and merge it into the
// coverage map.
//
// V8 reports byte offsets against the JS bytes it actually instrumented. When
// the entry already carries that source (Playwright's `coverage.stopJSCoverage`
// returns it on each entry, including the inline source map), we hand it
// straight to v8-to-istanbul so the offsets line up exactly. The server path
// uses Node's `NODE_V8_COVERAGE` JSON, which doesn't include source — there we
// re-derive by re-running our esbuild transform on the original TS file.
async function addV8EntryToCoverageMap(coverageMap, filePath, functions, source) {
    let { V8ToIstanbul } = getIstanbul();
    let converter = new V8ToIstanbul(filePath, undefined, { source });
    await converter.load();
    converter.applyCoverage(functions);
    coverageMap.merge(converter.toIstanbul());
    return true;
}
function shouldExcludeFromCoverage(filePath, rootDir, testFiles) {
    return (!filePath.startsWith(rootDir + path.sep) ||
        filePath.includes(`${path.sep}node_modules${path.sep}`) ||
        testFiles.has(filePath));
}
export async function collectServerCoverageMap(coverageDataDir, cwd, testFiles) {
    let { createCoverageMap } = getIstanbul();
    let coverageMap = createCoverageMap({});
    let converted = 0;
    let files;
    try {
        files = (await fsp.readdir(coverageDataDir)).filter((f) => f.startsWith('coverage-') && f.endsWith('.json'));
    }
    catch {
        return null;
    }
    for (let file of files) {
        let data = JSON.parse(await fsp.readFile(path.join(coverageDataDir, file), 'utf-8'));
        let scriptCoverages = data.result ?? [];
        for (let entry of scriptCoverages) {
            if (!entry.url.startsWith('file://'))
                continue;
            let filePath;
            try {
                filePath = fileURLToPath(entry.url);
            }
            catch {
                continue;
            }
            if (!filePath ||
                !['.ts', '.tsx'].includes(path.extname(filePath)) ||
                shouldExcludeFromCoverage(filePath, cwd, testFiles)) {
                continue;
            }
            try {
                // For server unit tests, we transform the TS with a module loader and V8 tracks
                // coverage using byte offsets from the transformed JS. Re-transform with the
                // same `esbuild` call here so offsets align, then pass the result with its
                // inline source map to v8-to-istanbul.
                let tsSource = await fsp.readFile(filePath, 'utf-8');
                let { code } = await transformTypeScript(tsSource, filePath);
                let success = await addV8EntryToCoverageMap(coverageMap, filePath, entry.functions, code);
                if (success)
                    converted++;
            }
            catch {
                // Skip files that can't be converted
            }
        }
    }
    // Clean up raw V8 coverage JSON files now that we've processed them
    //await Promise.all(files.map((f) => fsp.rm(path.join(coverageDataDir, f), { force: true })))
    return converted > 0 ? coverageMap : null;
}
export async function collectCoverageMapFromPlaywright(entries, rootDir, testFiles, resolveRelativePath) {
    let { createCoverageMap } = getIstanbul();
    let coverageMap = createCoverageMap({});
    let converted = 0;
    for (let entry of entries) {
        let filePath;
        try {
            let relativePath = await resolveRelativePath(new URL(entry.url).pathname);
            if (!relativePath)
                continue;
            // Ignore entries outside the root dir, entries in node_modules, and test files
            filePath = path.resolve(rootDir, relativePath);
            if (shouldExcludeFromCoverage(filePath, rootDir, testFiles)) {
                continue;
            }
            // Ensure file exists
            await fsp.access(filePath);
        }
        catch {
            continue;
        }
        if (!entry.source) {
            throw new Error(`Entry for ${entry.url} is missing source, cannot convert coverage. Ensure the browser launched with Playwright's JS coverage enabled.`);
        }
        try {
            let success = await addV8EntryToCoverageMap(coverageMap, filePath, entry.functions, entry.source);
            if (success)
                converted++;
        }
        catch {
            // Skip files that can't be converted
        }
    }
    return converted > 0 ? coverageMap : null;
}
export async function generateCombinedCoverageReport(maps, cwd, config) {
    let { createCoverageMap } = getIstanbul();
    let combined = createCoverageMap({});
    for (let map of maps) {
        if (map)
            combined.merge(map);
    }
    if (combined.files().length === 0) {
        console.log('No coverage data collected.');
        return true;
    }
    let filtered = filterCoverageMap(combined, cwd, config);
    await writeIstanbulReports(filtered, cwd, config.dir);
    return checkThresholds(filtered, config);
}
