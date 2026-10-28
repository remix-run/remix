import * as path from 'node:path';
const windowsDriveLetterRE = /^[A-Za-z]:\//;
const uncPrefixRE = /^\/\/[^/]+\/[^/]+/;
export function normalizeWindowsPath(filePath) {
    return filePath
        .replace(/\\/g, '/')
        .replace(windowsDriveLetterRE, (prefix) => `${prefix[0].toUpperCase()}${prefix.slice(1)}`);
}
export function normalizePathname(pathname) {
    let normalized = path.posix.normalize(normalizeWindowsPath(pathname));
    if (!normalized.startsWith('/')) {
        normalized = `/${normalized}`;
    }
    return normalized;
}
export function isAbsoluteFilePath(filePath) {
    let normalized = normalizeWindowsPath(filePath);
    return normalized.startsWith('/') || windowsDriveLetterRE.test(normalized);
}
export function normalizeFilePath(filePath) {
    let normalized = normalizeWindowsPath(filePath);
    let uncRoot = getUncRoot(normalized);
    if (uncRoot) {
        let remainder = normalized.slice(uncRoot.length);
        let normalizedRemainder = path.posix.normalize(remainder || '/');
        return `${uncRoot}${normalizedRemainder === '/' ? '' : normalizedRemainder}`;
    }
    if (windowsDriveLetterRE.test(normalized)) {
        return path.posix.normalize(normalized);
    }
    if (normalized.startsWith('/')) {
        return path.posix.normalize(normalized);
    }
    return path.posix.normalize(normalizeWindowsPath(path.resolve(normalized)));
}
export function resolveFilePath(rootDir, filePath) {
    if (isAbsoluteFilePath(filePath)) {
        return normalizeFilePath(filePath);
    }
    return normalizeFilePath(`${rootDir.replace(/\/+$/, '')}/${normalizeWindowsPath(filePath)}`);
}
export function getFilePathDirectory(filePath) {
    return path.posix.dirname(normalizeWindowsPath(filePath));
}
export function getRelativeFilePath(fromPath, toPath) {
    let normalizedFromPath = normalizeFilePath(fromPath);
    let normalizedToPath = normalizeFilePath(toPath);
    if (normalizedFromPath.startsWith('//') || normalizedToPath.startsWith('//')) {
        return normalizeWindowsPath(path.win32.relative(normalizedFromPath.replace(/\//g, '\\'), normalizedToPath.replace(/\//g, '\\')));
    }
    if (windowsDriveLetterRE.test(normalizedFromPath) ||
        windowsDriveLetterRE.test(normalizedToPath)) {
        return normalizeWindowsPath(path.win32.relative(normalizedFromPath.replace(/\//g, '\\'), normalizedToPath.replace(/\//g, '\\')));
    }
    return path.posix.relative(normalizedFromPath, normalizedToPath);
}
export function getFilePathBaseName(filePath) {
    return path.posix.basename(normalizeWindowsPath(filePath));
}
function getUncRoot(filePath) {
    return filePath.startsWith('//') ? (filePath.match(uncPrefixRE)?.[0] ?? null) : null;
}
