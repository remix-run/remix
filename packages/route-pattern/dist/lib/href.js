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
            // prettier-ignore
            stack[stack.length - 1].href +=
                part.type === 'pathname' && token.type === ':' ? encodePathnameVariable(value) :
                    part.type === 'pathname' && token.type === '*' ? encodePathnameWildcard(value) :
                        part.type === 'hostname' && token.type === ':' ? validateHostnameVariable(value) :
                            part.type === 'hostname' && token.type === '*' ? validateHostnameWildcard(value) :
                                unreachable();
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
        if (details.type === 'missing-hostname') {
            return `pattern requires hostname\n\nPattern: ${details.pattern}`;
        }
        if (details.type === 'nameless-wildcard') {
            return `pattern contains nameless wildcard\n\nPattern: ${details.pattern}`;
        }
        if (details.type === 'missing-params') {
            let params = details.missingParams.map((p) => `'${p}'`).join(', ');
            return `missing param(s): ${params}\n\nPattern: ${details.pattern}\nParams: ${JSON.stringify(details.params)}`;
        }
        if (details.type === 'invalid-hostname-variable') {
            return `invalid hostname variable param: ${JSON.stringify(details.value)} contains ${JSON.stringify(details.char)}`;
        }
        if (details.type === 'invalid-hostname-wildcard') {
            return `invalid hostname wildcard param: ${JSON.stringify(details.value)} contains ${JSON.stringify(details.char)}`;
        }
        unreachable(details);
    }
}
export function encodePathnameVariable(value) {
    return encodePathnameSegment(String(value));
}
export function encodePathnameWildcard(value) {
    return String(value).split('/').map(encodePathnameSegment).join('/');
}
/**
 * Keep pathname params from changing URL structure when parsed. `/`, `?`, and `#` are
 * path/query/fragment delimiters; `%` begins percent-encoded bytes; and `\\` is treated as a
 * path separator by special URL parsing.
 *
 * @see https://url.spec.whatwg.org/#path-percent-encode-set
 * @see https://url.spec.whatwg.org/#percent-encoded-bytes
 */
const PATHNAME_PARAM_STRUCTURAL_CHARS = {
    '/': '%2F',
    '?': '%3F',
    '#': '%23',
    '%': '%25',
    '\\': '%5C',
};
function encodePathnameSegment(value) {
    let encoded = '';
    for (let char of value) {
        let encodedChar = PATHNAME_PARAM_STRUCTURAL_CHARS[char];
        encoded += encodedChar === undefined ? char : encodedChar;
    }
    return encoded;
}
/**
 * Keep hostname params from changing URL authority structure when parsed. `@` ends userinfo,
 * `:` starts the port, and `/`, `?`, and `#` start the path, query, and fragment. Hostname
 * variables also reject `.` because dots separate host labels; hostname wildcards allow `.` to
 * span labels intentionally.
 *
 * @see https://url.spec.whatwg.org/#authority-state
 * @see https://url.spec.whatwg.org/#host-parsing
 */
const HOSTNAME_PARAM_STRUCTURAL_CHARS = ['@', ':', '/', '?', '#'];
export function validateHostnameVariable(value) {
    let serialized = String(value);
    for (let char of serialized) {
        if (char === '.' || HOSTNAME_PARAM_STRUCTURAL_CHARS.includes(char)) {
            throw new CreateHrefError({
                type: 'invalid-hostname-variable',
                value: serialized,
                char,
            });
        }
    }
    return serialized;
}
export function validateHostnameWildcard(value) {
    let serialized = String(value);
    for (let char of serialized) {
        if (HOSTNAME_PARAM_STRUCTURAL_CHARS.includes(char)) {
            throw new CreateHrefError({
                type: 'invalid-hostname-wildcard',
                value: serialized,
                char,
            });
        }
    }
    return serialized;
}
