import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeFilePath, resolveFilePath } from "./paths.js";
export function createAccessPolicy(options) {
    let allowMatchers = options.allow.map((pattern) => createFileMatcher(pattern, options.root));
    let denyMatchers = (options.deny ?? []).map((pattern) => createFileMatcher(pattern, options.root));
    return {
        isAllowed(filePath) {
            if (!allowMatchers.some((matcher) => matcher(filePath)))
                return false;
            if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath)))
                return false;
            return true;
        },
    };
}
function createFileMatcher(pattern, root, options = {}) {
    let resolvedPatternPath = resolveFilePath(root, pattern);
    let allowDirectories = options.allowDirectories ?? true;
    let allowMissing = options.allowMissing ?? true;
    if (!containsGlobSyntax(pattern)) {
        try {
            resolvedPatternPath = normalizeFilePath(fs.realpathSync(resolvedPatternPath));
        }
        catch (error) {
            if (!allowMissing || !isPathNotFoundError(error))
                throw error;
        }
        if (allowDirectories) {
            try {
                if (fs.statSync(resolveFilePath(root, pattern)).isDirectory()) {
                    return (filePath) => isSameOrDescendantPath(filePath, resolvedPatternPath);
                }
            }
            catch {
                // Missing exact paths fall back to exact-file matching until they exist on disk.
            }
        }
        return (filePath) => filePath === resolvedPatternPath;
    }
    return (filePath) => path.posix.matchesGlob(filePath, resolvedPatternPath);
}
function isSameOrDescendantPath(filePath, directoryPath) {
    let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '');
    return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`);
}
function containsGlobSyntax(pattern) {
    return /[*?[\]{}()!+@]/.test(pattern);
}
function isPathNotFoundError(error) {
    return (error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' ||
            error.code === 'ENOTDIR'));
}
