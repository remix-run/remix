import * as path from 'node:path';
import * as process from 'node:process';
import { resolveDefaultRemixVersion } from "./remix-version.js";
import { loadRemixConfig } from "./remix-config.js";
export async function resolveCliContext(options = {}) {
    let cwd = resolveCwd(options.cwd);
    let remixVersion = normalizeRemixVersion(options.remixVersion);
    let configPromise;
    let loadConfig = () => (configPromise ??= loadRemixConfig(cwd, options.configPath));
    // Validate an explicitly selected config file up front so every command
    // fails fast on a bad --config path. The default remix.json is loaded
    // lazily by the commands that read it, so an invalid file doesn't break
    // unrelated commands like help, version, or shell completion.
    if (options.configPath !== undefined)
        await loadConfig();
    return {
        configPath: options.configPath,
        cwd,
        loadConfig,
        remixVersion: remixVersion ?? (await resolveDefaultRemixVersion(cwd)),
    };
}
function resolveCwd(cwd) {
    let normalizedCwd = cwd?.trim();
    return path.resolve(normalizedCwd == null || normalizedCwd.length === 0 ? process.cwd() : normalizedCwd);
}
function normalizeRemixVersion(remixVersion) {
    let normalizedVersion = remixVersion?.trim();
    return normalizedVersion == null || normalizedVersion.length === 0 ? undefined : normalizedVersion;
}
