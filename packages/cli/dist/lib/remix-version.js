import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as process from 'node:process';
import { fileURLToPath } from 'node:url';
export async function resolveDefaultRemixVersion(cwd = process.cwd()) {
    for (let packageJsonPath of getRemixPackageJsonCandidates(cwd)) {
        let version = await readRemixPackageVersion(packageJsonPath);
        if (version != null) {
            return version;
        }
    }
}
function getRemixPackageJsonCandidates(cwd) {
    let candidates = [];
    let seen = new Set();
    function addCandidate(filePath) {
        if (filePath == null) {
            return;
        }
        let resolvedPath = path.resolve(filePath);
        if (seen.has(resolvedPath)) {
            return;
        }
        seen.add(resolvedPath);
        candidates.push(resolvedPath);
    }
    function addResolvedPackageJson(basePath) {
        try {
            addCandidate(createRequire(basePath).resolve('remix/package.json'));
        }
        catch { }
    }
    addResolvedPackageJson(path.join(cwd, 'package.json'));
    if (process.argv[1] != null) {
        addResolvedPackageJson(path.resolve(process.argv[1]));
    }
    addResolvedPackageJson(import.meta.url);
    addCandidate(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../remix/package.json'));
    return candidates;
}
async function readRemixPackageVersion(packageJsonPath) {
    let packageJson;
    try {
        packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    }
    catch {
        return undefined;
    }
    if (packageJson.name !== 'remix') {
        return undefined;
    }
    if (typeof packageJson.version !== 'string') {
        return undefined;
    }
    let version = packageJson.version.trim();
    return version.length === 0 ? undefined : version;
}
