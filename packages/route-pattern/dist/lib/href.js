import { RoutePattern } from "./route-pattern.js";
import { unreachable } from "./unreachable.js";
/**
 * Generate an href from a route pattern and the supplied params.
 *
 * @param pattern The parsed route pattern.
 * @param args Path params and optional search params.
 * @returns The generated href string.
 * @throws {CreateHrefError} When the pattern requires a hostname, contains a nameless wildcard,
 * is missing required params, or receives invalid params.
 */
export function createHref(pattern, ...args) {
    pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern;
    let patternParts = pattern._parts;
    let [params, searchParams] = args;
    searchParams ??= {};
    let hasOrigin = patternParts.protocol !== null || patternParts.hostname !== null || patternParts.port !== null;
    let result = '';
    if (hasOrigin) {
        let protocol = patternParts.protocol === null || patternParts.protocol === 'http(s)'
            ? 'https'
            : patternParts.protocol;
        if (patternParts.hostname === null) {
            throw new CreateHrefError({ type: 'missing-hostname', pattern });
        }
        let hostname = hrefPart(pattern, patternParts.hostname, params ?? {});
        let port = patternParts.port === null ? '' : `:${patternParts.port}`;
        result += `${protocol}://${hostname}${port}`;
    }
    let pathname = hrefPart(pattern, patternParts.pathname, params ?? {});
    result += '/' + pathname;
    let search = hrefSearch(patternParts.search, searchParams);
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
            if (value == null) {
                if (stack.length <= 1) {
                    if (token.name === '*') {
                        throw new CreateHrefError({ type: 'nameless-wildcard', pattern });
                    }
                    if (!missingParams.includes(token.name))
                        missingParams.push(token.name);
                    i += 1;
                    continue;
                }
                let frame = stack.pop();
                i = part.optionals.get(frame.begin) + 1;
                if (stack[stack.length - 1].href.endsWith(separator) &&
                    part.tokens[i]?.type === 'separator') {
                    i += 1;
                }
                continue;
            }
            // oxfmt-ignore
            stack[stack.length - 1].href +=
                part.type === 'pathname' && token.type === ':' ? encodePathnameVariableParam(pattern, token.name, value) :
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
            missingParams,
            params,
        });
    }
    if (stack.length !== 1)
        unreachable();
    return stack[0].href;
}
function hrefSearch(constraints, searchParams) {
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
            if (urlSearchParams.has(key))
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
        if (details.type === 'invalid-pathname-variable') {
            return `invalid pathname variable param: '${details.paramName}' cannot be empty\n\nPattern: ${details.pattern}\nValue: ${JSON.stringify(details.value)}`;
        }
        unreachable(details);
    }
}
function encodePathnameVariableParam(pattern, paramName, value) {
    let serialized = String(value);
    if (serialized.length === 0) {
        throw new CreateHrefError({
            type: 'invalid-pathname-variable',
            pattern,
            paramName,
            value: serialized,
        });
    }
    return encodePathnameSegment(serialized);
}
export function encodePathnameVariable(value) {
    return encodePathnameSegment(String(value));
}
export function encodePathnameWildcard(value) {
    return String(value).split('/').map(encodePathnameSegment).join('/');
}
function encodePathnameSegment(value) {
    return encodeURIComponent(value);
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
const HOSTNAME_PARAM_STRUCTURAL_CHARS = ['@', ':', '/', '?', '#', '%'];
export function validateHostnameVariable(value) {
    let serialized = String(value);
    for (let char of serialized) {
        if (char === '.' || isInvalidHostnameParamChar(char)) {
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
        if (isInvalidHostnameParamChar(char)) {
            throw new CreateHrefError({
                type: 'invalid-hostname-wildcard',
                value: serialized,
                char,
            });
        }
    }
    return serialized;
}
function isInvalidHostnameParamChar(char) {
    let code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f || HOSTNAME_PARAM_STRUCTURAL_CHARS.includes(char);
}
