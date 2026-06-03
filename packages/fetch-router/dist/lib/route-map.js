import { createHref } from '@remix-run/route-pattern/href';
import { parsePatternParts } from '@remix-run/route-pattern/parse';
/**
 * A route definition that includes a request method and pattern.
 */
export class Route {
    /**
     * The HTTP method this route matches.
     */
    method;
    /**
     * The parsed route-pattern AST. Useful for advanced consumers (e.g. matchers) that want to skip
     * re-parsing the source string.
     */
    get pattern() {
        if (!this.#pattern) {
            let parsed = parsePatternParts(this.#source);
            this.#pattern = createRoutePattern(serializeRoutePattern(parsed), parsed);
        }
        return this.#pattern;
    }
    /**
     * The route-pattern source string.
     */
    get source() {
        return this.#source;
    }
    #source;
    #pattern;
    /**
     * @param method The HTTP method this route matches
     * @param pattern The route-pattern source string or pre-parsed AST
     */
    constructor(method, pattern) {
        this.method = method;
        if (typeof pattern === 'string') {
            this.#source = pattern;
        }
        else {
            this.#source = getRoutePatternSource(pattern);
            this.#pattern = pattern;
        }
    }
    /**
     * Build a URL href for this route using the given parameters.
     *
     * @param args The parameters to use for building the href
     * @returns The built URL href
     */
    href(...args) {
        return createHref(this.#pattern ?? this.#source, ...args);
    }
}
export function createRoutes(baseOrDefs, defs) {
    let baseIsPattern = typeof baseOrDefs === 'string' || isRoutePattern(baseOrDefs);
    if (baseIsPattern) {
        return buildRouteMap(baseOrDefs, defs);
    }
    return buildRouteMap('/', baseOrDefs);
}
function buildRouteMap(base, defs) {
    let routes = {};
    for (let key in defs) {
        let def = defs[key];
        if (def instanceof Route) {
            routes[key] = new Route(def.method, joinRoutePatterns(base, def.source));
        }
        else if (typeof def === 'string') {
            routes[key] = new Route('ANY', joinRoutePatterns(base, def));
        }
        else if (isRoutePattern(def)) {
            routes[key] = new Route('ANY', joinRoutePatterns(base, def));
        }
        else if (isRouteDefObject(def)) {
            routes[key] = new Route(def.method ?? 'ANY', joinRoutePatterns(base, def.pattern));
        }
        else {
            routes[key] = buildRouteMap(base, def);
        }
    }
    return routes;
}
function isRoutePattern(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'protocol' in value &&
        'hostname' in value &&
        'port' in value &&
        'pathname' in value &&
        'search' in value);
}
function isRouteDefObject(value) {
    return typeof value === 'object' && value !== null && 'pattern' in value;
}
function joinRoutePatterns(base, next) {
    let baseParts = typeof base === 'string' ? parsePatternParts(base) : base;
    let nextParts = typeof next === 'string' ? parsePatternParts(next) : next;
    return serializeRoutePattern({
        protocol: nextParts.protocol ?? baseParts.protocol,
        hostname: nextParts.hostname ?? baseParts.hostname,
        port: nextParts.port ?? baseParts.port,
        pathname: joinPathname(baseParts.pathname, nextParts.pathname),
        search: joinSearch(baseParts.search, nextParts.search),
    });
}
function createRoutePattern(source, parsed) {
    return {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname,
        search: parsed.search,
        get source() {
            return source;
        },
        toString() {
            return source;
        },
        toJSON() {
            return {
                protocol: parsed.protocol ?? '',
                hostname: parsed.hostname ? serializePart(parsed.hostname) : '',
                port: parsed.port ?? '',
                pathname: serializePart(parsed.pathname),
                search: serializeSearch(parsed.search),
            };
        },
    };
}
function getRoutePatternSource(pattern) {
    let source = pattern.source;
    if (typeof source === 'string')
        return source;
    return serializeRoutePattern(pattern);
}
function joinPathname(base, next) {
    if (base.tokens.length === 0)
        return next;
    if (next.tokens.length === 0)
        return base;
    let tokens = [];
    let baseLastNonOptionalIndex = base.tokens.findLastIndex((token) => token.type !== '(' && token.type !== ')');
    let baseLastNonOptional = base.tokens[baseLastNonOptionalIndex];
    let baseHasTrailingSeparator = baseLastNonOptional?.type === 'separator';
    base.tokens.forEach((token, index) => {
        if (index === baseLastNonOptionalIndex && token.type === 'separator')
            return;
        tokens.push(token);
    });
    let nextFirstNonOptional = next.tokens.find((token) => token.type !== '(' && token.type !== ')');
    let needsSeparator = nextFirstNonOptional === undefined || nextFirstNonOptional.type !== 'separator';
    if (needsSeparator)
        tokens.push({ type: 'separator' });
    let tokenOffset = tokens.length;
    next.tokens.forEach((token) => tokens.push(token));
    let optionals = new Map();
    for (let [begin, end] of base.optionals) {
        if (baseHasTrailingSeparator) {
            if (begin > baseLastNonOptionalIndex)
                begin -= 1;
            if (end > baseLastNonOptionalIndex)
                end -= 1;
        }
        optionals.set(begin, end);
    }
    for (let [begin, end] of next.optionals) {
        optionals.set(tokenOffset + begin, tokenOffset + end);
    }
    return { tokens, optionals, type: 'pathname' };
}
function joinSearch(base, next) {
    let result = new Map();
    for (let [name, values] of base) {
        result.set(name, new Set(values));
    }
    for (let [name, values] of next) {
        let current = result.get(name);
        if (current === undefined) {
            result.set(name, new Set(values));
            continue;
        }
        for (let value of values) {
            current.add(value);
        }
    }
    return result;
}
function serializeRoutePattern(pattern) {
    let protocol = pattern.protocol ?? '';
    let hostname = pattern.hostname ? serializePart(pattern.hostname) : '';
    let port = pattern.port ?? '';
    let pathname = serializePart(pattern.pathname);
    let search = serializeSearch(pattern.search);
    let result = '';
    if (protocol || hostname || port) {
        result += `${protocol}://${hostname}${port === '' ? '' : `:${port}`}`;
    }
    result += '/' + pathname;
    if (search)
        result += `?${search}`;
    return result;
}
function serializeSearch(search) {
    if (search.size === 0)
        return '';
    let searchParams = new URLSearchParams();
    for (let [key, constraint] of search) {
        if (constraint.size === 0) {
            searchParams.append(key, '');
        }
        else {
            for (let value of constraint) {
                searchParams.append(key, value);
            }
        }
    }
    return searchParams.toString();
}
function escapeText(text) {
    return text.replaceAll(/[:*()\\]/g, '\\$&');
}
function serializePart(part) {
    let separator = part.type === 'hostname' ? '.' : '/';
    let result = '';
    for (let token of part.tokens) {
        if (token.type === '(' || token.type === ')') {
            result += token.type;
            continue;
        }
        if (token.type === 'text') {
            result += escapeText(token.text);
            continue;
        }
        if (token.type === ':' || token.type === '*') {
            let name = token.name === '*' ? '' : token.name;
            result += `${token.type}${name}`;
            continue;
        }
        if (token.type === 'separator') {
            result += separator;
            continue;
        }
    }
    return result;
}
