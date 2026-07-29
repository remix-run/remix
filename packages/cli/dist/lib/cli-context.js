import * as path from 'node:path';
import * as process from 'node:process';
import { resolveDefaultRemixVersion } from "./remix-version.js";
export async function resolveCliContext(options = {}) {
    let cwd = resolveCwd(options.cwd);
    let remixVersion = normalizeRemixVersion(options.remixVersion);
    return {
        cwd,
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
