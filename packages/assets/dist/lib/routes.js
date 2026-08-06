import { getRoutePatternCaptures, RoutePattern, } from '@remix-run/route-pattern';
import { createHref } from '@remix-run/route-pattern/href';
import { createMatcher } from '@remix-run/route-pattern/match';
import { getRelativeFilePath, isAbsoluteFilePath, normalizeFilePath, normalizePathname, resolveFilePath, } from "./paths.js";
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
    return {
        resolveUrlPathname(pathname) {
            let normalizedPathname = normalizePathname(pathname);
            for (let route of compiledRoutes) {
                let match = route.urlMatcher.match(`http://remix.run${normalizedPathname}`);
                if (!match)
                    continue;
                let relativeFilePath = decodeURIComponent(createHref(route.filePattern, match.params)).replace(/^\/+/, '');
                return resolveFilePath(route.rootDir, relativeFilePath);
            }
            return null;
        },
        toUrlPathname(filePath) {
            let normalizedFilePath = normalizeFilePath(filePath);
            for (let route of compiledRoutes) {
                let relativeFilePath = getRelativeFilePath(route.rootDir, normalizedFilePath);
                let match = route.fileMatcher.match(`http://remix.run/${relativeFilePath}`);
                if (!match)
                    continue;
                return normalizePathname(createHref(route.urlPattern, match.params));
            }
            return null;
        },
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
        rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
        urlPattern,
        urlMatcher: createMatcher(urlPattern),
        filePattern,
        fileMatcher: createMatcher(stripDotSegments(filePatternSource)),
    };
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
