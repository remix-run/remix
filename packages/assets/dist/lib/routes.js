import * as path from 'node:path';
import { RoutePattern } from '@remix-run/route-pattern';
import { isAbsoluteFilePath, normalizeFilePath, normalizePathname, resolveFilePath, } from "./paths.js";
function normalizeFilePattern(pattern) {
    if (isAbsoluteFilePath(pattern)) {
        throw new Error(`File route patterns must be relative to the asset server root.\nPattern: ${pattern}`);
    }
    return normalizePathname(pattern);
}
export function compileRoutes(options) {
    if (Object.keys(options.fileMap).length === 0) {
        throw new Error('createAssetServer() requires at least one configured fileMap entry.');
    }
    let compiledRoutes = Object.entries(options.fileMap).map(([urlPattern, filePattern]) => compileRoute({
        urlPattern,
        filePattern,
    }, { rootDir: options.rootDir }));
    return {
        resolveUrlPathname(pathname) {
            let normalizedPathname = normalizePathname(pathname);
            for (let route of compiledRoutes) {
                let match = route.urlPattern.match(`http://remix.run${normalizedPathname}`);
                if (!match)
                    continue;
                let relativeFilePath = route.filePattern.href(match.params).replace(/^\/+/, '');
                return resolveFilePath(route.rootDir, relativeFilePath);
            }
            return null;
        },
        toUrlPathname(filePath) {
            let normalizedFilePath = normalizeFilePath(filePath);
            for (let route of compiledRoutes) {
                let relativeFilePath = getRelativeFilePath(normalizedFilePath, route.rootDir);
                if (relativeFilePath === null)
                    continue;
                let match = route.filePattern.ast.pathname.match(relativeFilePath);
                if (!match)
                    continue;
                return normalizePathname(route.urlPattern.href(getPathnameParams(route.filePattern, match)));
            }
            return null;
        },
    };
}
function compileRoute(route, options) {
    let urlPatternSource = normalizePathname(route.urlPattern);
    let filePatternSource = normalizeFilePattern(route.filePattern);
    let urlPattern = new RoutePattern(urlPatternSource);
    let filePattern = new RoutePattern(filePatternSource);
    validateNoUnnamedWildcards(urlPattern, 'URL');
    validateNoUnnamedWildcards(filePattern, 'File');
    validateRoutePatterns(urlPattern, filePattern);
    return {
        rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
        urlPattern,
        filePattern,
    };
}
function getRelativeFilePath(filePath, rootDir) {
    if (filePath[1] === ':' && rootDir[1] === ':' && filePath[0] !== rootDir[0])
        return null;
    return path.posix.relative(rootDir, filePath);
}
function getPathnameParams(pattern, match) {
    let params = {};
    for (let param of pattern.ast.pathname.params) {
        if (param.name === '*')
            continue;
        params[param.name] = undefined;
    }
    for (let param of match) {
        if (param.name === '*')
            continue;
        params[param.name] = param.value;
    }
    return params;
}
function validateRoutePatterns(urlPattern, filePattern) {
    let urlParams = urlPattern.ast.pathname.params.map((param) => `${param.type}:${param.name}`);
    let fileParams = filePattern.ast.pathname.params.map((param) => `${param.type}:${param.name}`);
    if (urlParams.length !== fileParams.length) {
        throw new Error(`Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`);
    }
    for (let i = 0; i < urlParams.length; i++) {
        if (urlParams[i] !== fileParams[i]) {
            throw new Error(`Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`);
        }
    }
}
function validateNoUnnamedWildcards(pattern, label) {
    if (pattern.ast.pathname.params.some((param) => param.type === '*' && param.name === '*')) {
        throw new Error(`${label} route patterns must use named wildcards for reversible mapping.\nPattern: ${pattern}`);
    }
}
