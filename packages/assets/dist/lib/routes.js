import { getRoutePatternCaptures, RoutePattern, } from '@remix-run/route-pattern';
import { createHref } from '@remix-run/route-pattern/href';
import { createMatcher } from '@remix-run/route-pattern/match';
import { getRelativeFilePath, isAbsoluteFilePath, normalizeFilePath, normalizePathname, resolveFilePath, } from './paths.js';
function normalizeFilePattern(pattern) {
    if (isAbsoluteFilePath(pattern)) {
        throw new Error(`File route patterns must be relative to the asset server root.\nPattern: ${pattern}`);
    }
    return normalizePathname(pattern);
}
export function compileRoutes(basePath, routeConfigs) {
    if (routeConfigs.every((routeConfig) => Object.keys(routeConfig.fileMap).length === 0)) {
        throw new Error('createAssetServer() requires at least one configured fileMap entry.');
    }
    let compiledRoutes = routeConfigs.flatMap((routeConfig) => Object.entries(routeConfig.fileMap).map(([urlPattern, filePattern]) => compileRoute({
        filePattern,
        urlPattern,
    }, {
        basePath,
        rootDir: routeConfig.rootDir,
    })));
    function resolveUrlPathname(pathname) {
        let normalizedPathname = normalizePathname(pathname);
        for (let route of compiledRoutes) {
            let match = route.urlMatcher.match(`http://remix.run${normalizedPathname}`);
            if (!match)
                continue;
            let relativeFilePath = decodeURIComponent(createHref(route.filePattern, match.params)).replace(/^\/+/, '');
            return resolveFilePath(route.rootDir, relativeFilePath);
        }
        return null;
    }
    function toUrlPathname(filePath) {
        let normalizedFilePath = normalizeFilePath(filePath);
        for (let route of compiledRoutes) {
            let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath);
            let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`);
            if (!match)
                continue;
            let urlPathname = normalizePathname(createHref(route.urlPattern, match.params));
            return urlPathname;
        }
        return null;
    }
    return {
        getDirectoryRouteMapping(filePath) {
            let normalizedFilePath = normalizeFilePath(filePath);
            for (let routeIndex = 0; routeIndex < compiledRoutes.length; routeIndex++) {
                let route = compiledRoutes[routeIndex];
                let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath);
                let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`);
                if (!match)
                    continue;
                if (!route.fileMapScope)
                    return null;
                let urlPathname = normalizePathname(createHref(route.urlPattern, match.params));
                let scopeParams = { ...match.params, [route.fileMapScope.wildcardName]: '' };
                let urlDirectory = ensureTrailingSlash(createHref(route.urlPattern, scopeParams));
                let relativeFileDirectory = decodeURIComponent(createHref(route.filePattern, scopeParams)).replace(/^\/+/, '');
                let fileDirectory = resolveFilePath(route.rootDir, relativeFileDirectory);
                let importerUrlDirectory = getUrlDirectory(urlPathname);
                let narrowedUrlDirectory = urlDirectory;
                let hasRouteBarrier = false;
                for (let otherIndex = 0; otherIndex < compiledRoutes.length; otherIndex++) {
                    if (otherIndex === routeIndex)
                        continue;
                    let otherRoute = compiledRoutes[otherIndex];
                    if (otherRoute.fileMapScope)
                        continue;
                    if (!routeCanMatchWithinDirectory(otherRoute, urlDirectory))
                        continue;
                    if (routeCanMatchWithinDirectory(otherRoute, importerUrlDirectory))
                        return null;
                    narrowedUrlDirectory = getChildUrlDirectory(urlDirectory, importerUrlDirectory);
                    hasRouteBarrier = true;
                }
                if (hasRouteBarrier) {
                    let relativeDirectory = narrowedUrlDirectory
                        .slice(urlDirectory.length)
                        .replace(/\/+$/, '');
                    return {
                        fileDirectory: ensureTrailingSlash(resolveFilePath(fileDirectory, relativeDirectory)),
                        urlDirectory: narrowedUrlDirectory,
                    };
                }
                return {
                    fileDirectory: ensureTrailingSlash(fileDirectory),
                    urlDirectory,
                };
            }
            return null;
        },
        resolveUrlPathname,
        toUrlPathname,
    };
}
function compileRoute(route, options) {
    let basePath = normalizePathname(options.basePath).replace(/\/+$/, '') || '/';
    let relativeUrlPattern = normalizePathname(route.urlPattern);
    let urlPatternSource = normalizePathname(`${basePath.replace(/\/+$/, '')}/${relativeUrlPattern.replace(/^\/+/, '')}`);
    let filePatternSource = normalizeFilePattern(route.filePattern);
    let urlPattern = RoutePattern.parse(urlPatternSource);
    let filePattern = RoutePattern.parse(filePatternSource);
    validateNoUnnamedWildcards(urlPattern, 'URL');
    validateNoUnnamedWildcards(filePattern, 'File');
    validateRoutePatterns(urlPattern, filePattern);
    return {
        fileMapScope: getFileMapScope(urlPattern, filePattern),
        rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
        urlPattern,
        urlMatcher: createMatcher(urlPattern),
        filePattern,
        fileMatcher: createMatcher(stripDotSegments(filePatternSource)),
    };
}
function getFileMapScope(urlPattern, filePattern) {
    let urlCaptures = getPathnameCaptures(urlPattern);
    let fileCaptures = getPathnameCaptures(filePattern);
    let finalCapture = urlCaptures[urlCaptures.length - 1];
    if (!finalCapture || finalCapture.type !== '*' || finalCapture.optional)
        return null;
    let wildcardSuffix = `*${finalCapture.name}`;
    let urlPathname = urlPattern.toJSON().pathname;
    let filePathname = filePattern.toJSON().pathname;
    if (!urlPathname.endsWith(wildcardSuffix) || !filePathname.endsWith(wildcardSuffix))
        return null;
    let urlPrefix = urlPathname.slice(0, -wildcardSuffix.length);
    let filePrefix = filePathname.slice(0, -wildcardSuffix.length);
    if (!isSegmentBoundary(urlPrefix) || !isSegmentBoundary(filePrefix))
        return null;
    return { wildcardName: finalCapture.name };
}
function isSegmentBoundary(prefix) {
    return prefix === '' || prefix.endsWith('/');
}
function routeCanMatchWithinDirectory(route, directory) {
    let pathname = route.urlPattern.toJSON().pathname;
    let dynamicIndex = pathname.search(/[:*(]/);
    let staticPrefix = normalizePathname(dynamicIndex === -1 ? pathname : pathname.slice(0, dynamicIndex));
    return (ensureTrailingSlash(staticPrefix).startsWith(directory) ||
        directory.startsWith(ensureTrailingSlash(staticPrefix)));
}
function ensureTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`;
}
function getUrlDirectory(pathname) {
    return ensureTrailingSlash(pathname.slice(0, pathname.lastIndexOf('/') + 1));
}
function getChildUrlDirectory(parentDirectory, descendantDirectory) {
    let relativePathname = descendantDirectory.slice(parentDirectory.length);
    let firstSlashIndex = relativePathname.indexOf('/');
    let firstSegment = firstSlashIndex === -1 ? relativePathname : relativePathname.slice(0, firstSlashIndex);
    return `${parentDirectory}${firstSegment}/`;
}
function stripDotSegments(pattern) {
    let segments = [];
    for (let segment of pattern.split('/')) {
        if (segment === '' || segment === '.')
            continue;
        if (segment === '..') {
            segments.pop();
            continue;
        }
        segments.push(segment);
    }
    return segments.join('/');
}
function validateRoutePatterns(urlPattern, filePattern) {
    let urlCaptures = getPathnameCaptures(urlPattern);
    let fileCaptures = getPathnameCaptures(filePattern);
    if (urlCaptures.length !== fileCaptures.length) {
        throw new Error(`Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`);
    }
    for (let i = 0; i < urlCaptures.length; i++) {
        let urlCapture = urlCaptures[i];
        let fileCapture = fileCaptures[i];
        if (urlCapture.type !== fileCapture.type || urlCapture.name !== fileCapture.name) {
            throw new Error(`Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`);
        }
    }
}
function validateNoUnnamedWildcards(pattern, label) {
    if (getRoutePatternCaptures(pattern).some((capture) => capture.part === 'pathname' && capture.type === '*' && capture.name === '*')) {
        throw new Error(`${label} route patterns must use named wildcards for reversible mapping.\nPattern: ${pattern}`);
    }
}
function getPathnameCaptures(pattern) {
    return getRoutePatternCaptures(pattern).filter((capture) => capture.part === 'pathname');
}
