import { parse } from "./parse.js";
/**
 * An error thrown when a required parameter is missing when building an href.
 */
export class MissingParamError extends Error {
    /**
     * The name of the missing parameter.
     */
    paramName;
    /**
     * @param paramName The name of the missing parameter
     */
    constructor(paramName) {
        super(`Missing required parameter: ${paramName}`);
        this.name = 'MissingParamError';
        this.paramName = paramName;
    }
}
/**
 * Create a reusable href builder function.
 *
 * @returns A function that builds hrefs from patterns and parameters
 */
export function createHrefBuilder() {
    return (pattern, ...args) => formatHref(parse(typeof pattern === 'string' ? pattern : pattern.source), ...args);
}
export function formatHref(parsed, params, searchParams) {
    params = params ?? {};
    let href = '';
    if (parsed.hostname != null) {
        // Default protocol is https because it's free these days so there's no
        // excuse not to use it.
        let protocol = parsed.protocol != null ? resolveTokens(parsed.protocol, '', params) : 'https';
        let hostname = resolveTokens(parsed.hostname, '.', params);
        let port = parsed.port != null ? `:${parsed.port}` : '';
        href += `${protocol}://${hostname}${port}`;
    }
    if (parsed.pathname != null) {
        let pathname = resolveTokens(parsed.pathname, '/', params);
        href += pathname.startsWith('/') ? pathname : `/${pathname}`;
    }
    else {
        href += '/';
    }
    if (searchParams) {
        let urlSearchParams;
        if (typeof searchParams === 'object' &&
            !Array.isArray(searchParams) &&
            !(searchParams instanceof URLSearchParams)) {
            let filteredParams = {};
            for (let key in searchParams) {
                let value = searchParams[key];
                if (value != null) {
                    filteredParams[key] = String(value);
                }
            }
            urlSearchParams = new URLSearchParams(filteredParams);
        }
        else {
            urlSearchParams = new URLSearchParams(searchParams);
        }
        let search = urlSearchParams.toString();
        if (search !== '') {
            href += `?${search}`;
        }
    }
    else if (parsed.search) {
        href += `?${parsed.search}`;
    }
    return href;
}
function resolveTokens(tokens, sep, params) {
    let str = '';
    for (let token of tokens) {
        if (token.type === 'variable' || token.type === 'wildcard') {
            let name = token.name ?? '*';
            if (params[name] == null)
                throw new MissingParamError(name);
            str += String(params[name]);
        }
        else if (token.type === 'text') {
            str += token.value;
        }
        else if (token.type === 'separator') {
            str += sep;
        }
        else if (token.type === 'optional') {
            try {
                str += resolveTokens(token.tokens, sep, params);
            }
            catch (error) {
                if (!(error instanceof MissingParamError)) {
                    throw error;
                }
                // Missing required parameter, ok to skip since it's optional
            }
        }
    }
    return str;
}
