import * as os from 'node:os';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import * as util from 'node:util';
import { tsImport } from 'tsx/esm/api';
export const defaultTestGlob = '**/*.test?(.browser)?(.e2e).{ts,tsx}';
const cliOptions = {
    'glob.test': { type: 'string' },
    concurrency: { type: 'string', short: 'c' },
    config: { type: 'string' },
    setup: { type: 'string' },
    reporter: { type: 'string', short: 'r' },
    type: { type: 'string', short: 't' },
    watch: { type: 'boolean', short: 'w' },
};
export async function loadConfig() {
    let parsed = parseCliArgs();
    let fileConfig = await loadConfigFile(parsed.values.config);
    let config = resolveConfig(fileConfig, parsed);
    return config;
}
function parseCliArgs(args = process.argv.slice(2)) {
    return util.parseArgs({ args, options: cliOptions, allowPositionals: true });
}
function resolveConfig(fileConfig, { values: cliValues, positionals }) {
    return {
        glob: {
            test: positionals[0] ?? cliValues['glob.test'] ?? fileConfig.glob?.test ?? defaultTestGlob,
        },
        concurrency: Number(cliValues.concurrency ?? fileConfig.concurrency ?? os.availableParallelism()),
        setup: cliValues.setup ?? fileConfig.setup,
        reporter: cliValues.reporter ?? fileConfig.reporter ?? (process.env.CI === 'true' ? 'dot' : 'spec'),
        watch: cliValues.watch ?? fileConfig.watch,
    };
}
async function loadConfigFile(configPath) {
    let candidates = configPath
        ? [path.resolve(process.cwd(), configPath)]
        : [
            path.join(process.cwd(), 'remix-test.config.ts'),
            path.join(process.cwd(), 'remix-test.config.js'),
        ];
    for (let candidate of candidates) {
        try {
            await fsp.access(candidate);
            let mod = await tsImport(candidate, { parentURL: import.meta.url });
            return mod.default ?? mod;
        }
        catch {
            // not found or failed to load — try next
        }
    }
    return {};
}
