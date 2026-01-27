import { formatHref } from "./href.js";
import { join } from "./join.js";
import { parse } from "./parse.js";
import { parseSearch } from "./search-constraints.js";
/**
 * A pattern for matching URLs.
 */
export class RoutePattern {
    /**
     * The source string that was used to create this pattern.
     */
    source;
    /**
     * Whether to ignore case when matching URL pathnames.
     */
    ignoreCase;
    #parsed;
    #compiled;
    /**
     * @param source The source pattern string or another `RoutePattern` to copy
     * @param options Options for the pattern
     */
    constructor(source, options) {
        this.source = typeof source === 'string' ? source : source.source;
        this.ignoreCase = options?.ignoreCase === true;
        this.#parsed = parse(this.source);
    }
    /**
     * Generate a href (URL) for this pattern.
     *
     * @param args The parameters and optional search params
     * @returns The href
     */
    href(...args) {
        return formatHref(this.#parsed, ...args);
    }
    /**
     * Join this pattern with another pattern. This is useful when building a pattern relative to a
     * base pattern.
     *
     * Note: The returned pattern will use the same options as this pattern.
     *
     * @param input The pattern to join with
     * @returns The joined pattern
     */
    join(input) {
        let parsedInput = parse(typeof input === 'string' ? input : input.source);
        return new RoutePattern(join(this.#parsed, parsedInput), {
            ignoreCase: this.ignoreCase,
        });
    }
    /**
     * Match a URL against this pattern.
     *
     * @param url The URL to match
     * @returns The match result, or `null` if the URL doesn't match
     */
    match(url) {
        if (typeof url === 'string')
            url = new URL(url);
        let { matchOrigin, matcher, paramNames } = this.#compile();
        let pathname = this.ignoreCase ? url.pathname.toLowerCase() : url.pathname;
        let match = matcher.exec(matchOrigin ? `${url.origin}${pathname}` : pathname);
        if (match === null)
            return null;
        // Map positional capture groups to parameter names in source order
        let params = {};
        for (let i = 0; i < paramNames.length; i++) {
            let paramName = paramNames[i];
            params[paramName] = match[i + 1];
        }
        if (this.#parsed.searchConstraints != null &&
            !matchSearch(url.search, this.#parsed.searchConstraints)) {
            return null;
        }
        return { url, params };
    }
    #compile() {
        if (this.#compiled)
            return this.#compiled;
        this.#compiled = compilePattern(this.#parsed, this.ignoreCase);
        return this.#compiled;
    }
    /**
     * Test if a URL matches this pattern.
     *
     * @param url The URL to test
     * @returns `true` if the URL matches this pattern, `false` otherwise
     */
    test(url) {
        return this.match(url) !== null;
    }
    toString() {
        return this.source;
    }
}
function compilePattern(parsed, ignoreCase) {
    let { protocol, hostname, port, pathname } = parsed;
    let matchOrigin = hostname !== undefined;
    let matcher;
    let paramNames = [];
    if (matchOrigin) {
        let protocolSource = protocol
            ? tokensToRegExpSource(protocol, '', '.*', paramNames, true)
            : '[^:]+';
        let hostnameSource = hostname
            ? tokensToRegExpSource(hostname, '.', '[^.]+?', paramNames, true)
            : '[^/:]+';
        let portSource = port !== undefined ? `:${regexpEscape(port)}` : '(?::[0-9]+)?';
        let pathnameSource = pathname
            ? tokensToRegExpSource(pathname, '/', '[^/]+?', paramNames, ignoreCase)
            : '';
        matcher = new RegExp(`^${protocolSource}://${hostnameSource}${portSource}/${pathnameSource}$`);
    }
    else {
        let pathnameSource = pathname
            ? tokensToRegExpSource(pathname, '/', '[^/]+?', paramNames, ignoreCase)
            : '';
        matcher = new RegExp(`^/${pathnameSource}$`);
    }
    return { matchOrigin, matcher, paramNames };
}
function tokensToRegExpSource(tokens, sep, paramRegExpSource, paramNames, forceLowerCase) {
    let source = '';
    for (let token of tokens) {
        if (token.type === 'variable') {
            paramNames.push(token.name);
            source += `(${paramRegExpSource})`;
        }
        else if (token.type === 'wildcard') {
            if (token.name) {
                paramNames.push(token.name);
                source += `(.*)`;
            }
            else {
                source += `(?:.*)`;
            }
        }
        else if (token.type === 'text') {
            source += regexpEscape(forceLowerCase ? token.value.toLowerCase() : token.value);
        }
        else if (token.type === 'separator') {
            source += regexpEscape(sep);
        }
        else if (token.type === 'optional') {
            source += `(?:${tokensToRegExpSource(token.tokens, sep, paramRegExpSource, paramNames, forceLowerCase)})?`;
        }
    }
    return source;
}
function regexpEscape(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function matchSearch(search, constraints) {
    let { namesWithoutAssignment, namesWithAssignment, valuesByKey } = parseSearch(search);
    for (let [key, constraint] of constraints) {
        let hasAssigned = namesWithAssignment.has(key), hasBare = namesWithoutAssignment.has(key), values = valuesByKey.get(key);
        if (constraint.requiredValues && constraint.requiredValues.size > 0) {
            if (!values)
                return false;
            for (let value of constraint.requiredValues) {
                if (!values.has(value))
                    return false;
            }
            continue;
        }
        if (constraint.requireAssignment) {
            if (!hasAssigned)
                return false;
            continue;
        }
        if (!(hasAssigned || hasBare))
            return false;
    }
    return true;
}
