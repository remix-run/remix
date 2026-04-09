import { RoutePattern } from '@remix-run/route-pattern';
import { isAbsoluteFilePath, normalizeFilePath, normalizePathname, resolveFilePath, } from "./paths.js";
function normalizeFilePattern(pattern) {
    if (isAbsoluteFilePath(pattern)) {
        throw new Error(`File route patterns must be relative to style-server root.\nPattern: ${pattern}`);
    }
    return normalizePathname(pattern);
}
export function compileRoutes(options) {
    if (options.routes.length === 0) {
        throw new Error('createStyleServer() requires at least one configured route.');
    }
    let compiledRoutes = options.routes.map((route) => compileRoute(route, { root: options.root }));
    return {
        resolveUrlPathname(pathname) {
            let normalizedPathname = normalizePathname(pathname);
            for (let route of compiledRoutes) {
                let match = route.urlPattern.match(`http://remix.run${normalizedPathname}`);
                if (!match)
                    continue;
                let relativeFilePath = route.filePattern.href(match.params).replace(/^\/+/, '');
                return resolveFilePath(route.root, relativeFilePath);
            }
            return null;
        },
        toUrlPathname(filePath) {
            let normalizedFilePath = normalizeFilePath(filePath);
            for (let route of compiledRoutes) {
                let relativeFilePath = getRelativeFilePath(normalizedFilePath, route.root);
                if (relativeFilePath === null)
                    continue;
                let fileUrl = new URL(`http://remix.run/${relativeFilePath}`);
                let match = route.filePattern.match(fileUrl);
                if (!match)
                    continue;
                return normalizePathname(route.urlPattern.href(match.params));
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
    return { root: normalizeFilePath(options.root).replace(/\/+$/, ''), urlPattern, filePattern };
}
function getRelativeFilePath(filePath, root) {
    if (filePath === root)
        return '';
    if (!filePath.startsWith(`${root}/`))
        return null;
    return filePath.slice(root.length + 1);
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
