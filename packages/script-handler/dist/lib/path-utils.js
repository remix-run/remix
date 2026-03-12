import * as path from 'node:path';
function toPosixPath(p) {
    return p.split(path.sep).join('/');
}
export function normalizeRootPrefix(prefix) {
    if (prefix == null)
        return null;
    let normalized = prefix.trim().replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
    if (normalized === '')
        return null;
    if (normalized.includes('\\')) {
        throw new Error(`Invalid root prefix "${prefix}". Prefixes must use "/" separators.`);
    }
    let segments = normalized.split('/');
    if (segments.some((segment) => segment === '.' || segment === '..')) {
        throw new Error(`Invalid root prefix "${prefix}". Prefixes cannot contain "." or ".." segments.`);
    }
    return normalized;
}
function joinPublicPath(prefix, relativePath) {
    let normalizedRelativePath = toPosixPath(relativePath);
    if (prefix == null)
        return normalizedRelativePath;
    return normalizedRelativePath === '' ? prefix : `${prefix}/${normalizedRelativePath}`;
}
function isPathInsideDirectory(absolutePath, directory) {
    return absolutePath === directory || absolutePath.startsWith(directory + path.sep);
}
function matchesPrefixBoundary(publicPath, prefix) {
    return publicPath === prefix || publicPath.startsWith(`${prefix}/`);
}
export function resolveAbsolutePathFromResolvedRoots(absolutePath, roots) {
    for (let resolvedRoot of roots) {
        if (!isPathInsideDirectory(absolutePath, resolvedRoot.directory))
            continue;
        let relativePath = toPosixPath(path.relative(resolvedRoot.directory, absolutePath));
        return {
            resolvedRoot,
            relativePath,
            publicPath: joinPublicPath(resolvedRoot.prefix, relativePath),
        };
    }
    return null;
}
export function resolvePublicPathFromResolvedRoots(publicPath, roots) {
    let normalizedPublicPath = publicPath.replace(/^\/+/, '');
    for (let resolvedRoot of roots) {
        if (resolvedRoot.prefix == null)
            continue;
        if (!matchesPrefixBoundary(normalizedPublicPath, resolvedRoot.prefix))
            continue;
        return {
            resolvedRoot,
            relativePath: normalizedPublicPath === resolvedRoot.prefix
                ? ''
                : normalizedPublicPath.slice(resolvedRoot.prefix.length + 1),
            publicPath: normalizedPublicPath,
        };
    }
    let fallbackRoot = roots.find((resolvedRoot) => resolvedRoot.prefix == null);
    if (!fallbackRoot)
        return null;
    return {
        resolvedRoot: fallbackRoot,
        relativePath: normalizedPublicPath,
        publicPath: normalizedPublicPath,
    };
}
