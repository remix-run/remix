import { parsePatternParts } from "./route-pattern/parse-parts.js";
/**
 * Generate an href from a route pattern and the supplied params.
 *
 * @param pattern The parsed route pattern.
 * @param args Path params and optional search params.
 * @returns The generated href string.
 * @throws {CreateHrefError} When the pattern requires a hostname, contains a nameless wildcard, or is missing required params.
 */
export function createHref(pattern, ...args) {
    let parsedPattern;
    let patternSource;
    if (typeof pattern === 'string') {
        patternSource = pattern;
        parsedPattern = parsePatternParts(pattern);
    }
    else {
        parsedPattern = pattern;
    }
    let [params, searchParams] = args;
    let hrefParams = params ?? {};
    searchParams ??= {};
    let hasOrigin = parsedPattern.protocol !== null ||
        parsedPattern.hostname !== null ||
        parsedPattern.port !== null;
    let result = '';
    if (hasOrigin) {
        let protocol = parsedPattern.protocol === null || parsedPattern.protocol === 'http(s)'
            ? 'https'
            : parsedPattern.protocol;
        if (parsedPattern.hostname === null) {
            throw new CreateHrefError({
                type: 'missing-hostname',
                pattern: parsedPattern,
                source: patternSource,
            });
        }
        let hostname = hrefPart(parsedPattern, parsedPattern.hostname, hrefParams, patternSource);
        let port = parsedPattern.port === null ? '' : `:${parsedPattern.port}`;
        result += `${protocol}://${hostname}${port}`;
    }
    let pathname = hrefPart(parsedPattern, parsedPattern.pathname, hrefParams, patternSource);
    result += '/' + pathname;
    let search = hrefSearch(parsedPattern, searchParams);
    if (search)
        result += `?${search}`;
    return result;
}
function hrefPart(pattern, part, params, source) {
    let separator = part.type === 'hostname' ? '.' : '/';
    let encodeVariable = part.type === 'pathname' ? encodePathnameVariable : validateHostnameVariable;
    let encodeWildcard = part.type === 'pathname' ? encodePathnameWildcard : validateHostnameWildcard;
    let missingParams;
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
                        throw new CreateHrefError({ type: 'nameless-wildcard', pattern, source });
                    }
                    ;
                    (missingParams ??= []).push(token.name);
                }
                let frame = stack.pop();
                i = part.optionals.get(frame.begin) + 1;
                continue;
            }
            stack[stack.length - 1].href +=
                token.type === ':' ? encodeVariable(value) : encodeWildcard(value);
            i += 1;
            continue;
        }
        unreachable(token.type);
    }
    if (missingParams) {
        throw new CreateHrefError({
            type: 'missing-params',
            pattern,
            source,
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
    let entries = Object.entries(searchParams);
    if (constraints.size === 0 && entries.length === 0) {
        return undefined;
    }
    let urlSearchParams = new URLSearchParams();
    for (let [key, value] of entries) {
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
                if (!urlSearchParams.has(key, value))
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
            return `pattern requires hostname\n\nPattern: ${formatPattern(details)}`;
        }
        if (details.type === 'nameless-wildcard') {
            return `pattern contains nameless wildcard\n\nPattern: ${formatPattern(details)}`;
        }
        if (details.type === 'missing-params') {
            let params = details.missingParams.map((p) => `'${p}'`).join(', ');
            return `missing param(s): ${params}\n\nPattern: ${formatPattern(details)}\nParams: ${JSON.stringify(details.params)}`;
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
function formatPattern(details) {
    return details.source ?? String(details.pattern);
}
function encodePathnameVariable(value) {
    return encodePathnameSegment(String(value));
}
function encodePathnameWildcard(value) {
    return String(value).split('/').map(encodePathnameSegment).join('/');
}
/**
 * Keep pathname params from changing URL structure when parsed. `/`, `?`, and `#` are
 * path/query/fragment delimiters; `%` begins percent-encoded bytes; and `\\` is treated as a
 * path separator by special URL parsing.
 *
 * @param value Pathname segment value to encode.
 * @returns Encoded pathname segment.
 * @see https://url.spec.whatwg.org/#path-percent-encode-set
 * @see https://url.spec.whatwg.org/#percent-encoded-bytes
 */
function encodePathnameSegment(value) {
    return value.replace(/[/?#%\\]/g, encodeURIComponent);
}
/**
 * Keep hostname params from changing URL authority structure when parsed. `@` ends userinfo,
 * `:` starts the port, and `/`, `?`, and `#` start the path, query, and fragment. Hostname
 * variables also reject `.` because dots separate host labels; hostname wildcards allow `.` to
 * span labels intentionally.
 *
 * @param value Hostname variable value to validate.
 * @returns Serialized hostname variable value.
 * @see https://url.spec.whatwg.org/#authority-state
 * @see https://url.spec.whatwg.org/#host-parsing
 */
function validateHostnameVariable(value) {
    let serialized = String(value);
    let invalid = /[.@:/?#]/.exec(serialized);
    if (invalid) {
        throw new CreateHrefError({
            type: 'invalid-hostname-variable',
            value: serialized,
            char: invalid[0],
        });
    }
    return serialized;
}
function validateHostnameWildcard(value) {
    let serialized = String(value);
    let invalid = /[@:/?#]/.exec(serialized);
    if (invalid) {
        throw new CreateHrefError({
            type: 'invalid-hostname-wildcard',
            value: serialized,
            char: invalid[0],
        });
    }
    return serialized;
}
function unreachable(_value) {
    throw new Error('Unreachable');
}
