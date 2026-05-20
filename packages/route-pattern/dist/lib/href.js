import { RoutePattern } from "./route-pattern.js";
import { unreachable } from "./unreachable.js";
/**
 * Generate an href from a route pattern and the supplied params.
 *
 * @param pattern The parsed route pattern.
 * @param args Path params and optional search params.
 * @returns The generated href string.
 * @throws {CreateHrefError} When the pattern requires a hostname, contains a nameless wildcard, or is missing required params.
 */
export function createHref(pattern, ...args) {
    pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern;
    let [params, searchParams] = args;
    searchParams ??= {};
    let hasOrigin = pattern.protocol !== null || pattern.hostname !== null || pattern.port !== null;
    let result = '';
    if (hasOrigin) {
        let protocol = pattern.protocol === null || pattern.protocol === 'http(s)' ? 'https' : pattern.protocol;
        if (pattern.hostname === null) {
            throw new CreateHrefError({ type: 'missing-hostname', pattern });
        }
        let hostname = hrefPart(pattern, pattern.hostname, params ?? {});
        let port = pattern.port === null ? '' : `:${pattern.port}`;
        result += `${protocol}://${hostname}${port}`;
    }
    let pathname = hrefPart(pattern, pattern.pathname, params ?? {});
    result += '/' + pathname;
    let search = hrefSearch(pattern, searchParams);
    if (search)
        result += `?${search}`;
    return result;
}
function hrefPart(pattern, part, params) {
    let separator = part.type === 'hostname' ? '.' : '/';
    let missingParams = [];
    let stack = [{ href: '' }];
    let i = 0;
    while (i < part.tokens.length) {
        let token = part.tokens[i];
        if (token.type === 'text') {
            stack[stack.length - 1].href += token.text;
            i += 1;
            continue;
        }
        if (token.type === 'separator') {
            stack[stack.length - 1].href += separator;
            i += 1;
            continue;
        }
        if (token.type === '(') {
            stack.push({ begin: i, href: '' });
            i += 1;
            continue;
        }
        if (token.type === ')') {
            let frame = stack.pop();
            stack[stack.length - 1].href += frame.href;
            i += 1;
            continue;
        }
        if (token.type === ':' || token.type === '*') {
            let value = params[token.name];
            if (value === undefined) {
                if (stack.length <= 1) {
                    if (token.name === '*') {
                        throw new CreateHrefError({ type: 'nameless-wildcard', pattern });
                    }
                    missingParams.push(token.name);
                }
                let frame = stack.pop();
                i = part.optionals.get(frame.begin) + 1;
                continue;
            }
            stack[stack.length - 1].href += typeof value === 'string' ? value : String(value);
            i += 1;
            continue;
        }
        unreachable(token.type);
    }
    if (missingParams.length > 0) {
        throw new CreateHrefError({
            type: 'missing-params',
            pattern,
            part,
            missingParams,
            params,
        });
    }
    if (stack.length !== 1)
        unreachable();
    return stack[0].href;
}
function hrefSearch(pattern, searchParams) {
    let constraints = pattern.search;
    if (constraints.size === 0 && Object.keys(searchParams).length === 0) {
        return undefined;
    }
    let urlSearchParams = new URLSearchParams();
    for (let [key, value] of Object.entries(searchParams)) {
        if (Array.isArray(value)) {
            for (let v of value) {
                if (v != null)
                    urlSearchParams.append(key, String(v));
            }
        }
        else if (value != null) {
            urlSearchParams.append(key, String(value));
        }
    }
    for (let [key, requiredValues] of constraints) {
        if (requiredValues.size === 0) {
            if (key in searchParams)
                continue;
            urlSearchParams.append(key, '');
        }
        else {
            for (let value of requiredValues) {
                if (urlSearchParams.getAll(key).includes(value))
                    continue;
                urlSearchParams.append(key, value);
            }
        }
    }
    let result = urlSearchParams.toString();
    return result || undefined;
}
/** Error thrown when a route pattern cannot generate an href from the supplied args. */
export class CreateHrefError extends Error {
    details;
    constructor(details) {
        super(CreateHrefError.message(details));
        this.name = 'CreateHrefError';
        this.details = details;
    }
    static message(details) {
        let pattern = details.pattern.toString();
        if (details.type === 'missing-hostname') {
            return `pattern requires hostname\n\nPattern: ${pattern}`;
        }
        if (details.type === 'nameless-wildcard') {
            return `pattern contains nameless wildcard\n\nPattern: ${pattern}`;
        }
        if (details.type === 'missing-params') {
            let params = details.missingParams.map((p) => `'${p}'`).join(', ');
            return `missing param(s): ${params}\n\nPattern: ${pattern}\nParams: ${JSON.stringify(details.params)}`;
        }
        unreachable(details);
    }
}
