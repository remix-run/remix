import { RoutePattern } from "./route-pattern.js";
/**
 * Join two route patterns.
 *
 * Origin parts (`protocol`, `hostname`, `port`) from `next` override `base` when present.
 * Pathnames are concatenated with a separator inserted between them as needed.
 * Search constraints from both patterns are merged.
 *
 * @param base The base pattern.
 * @param next The next pattern to join onto `base`.
 * @returns The joined route pattern.
 */
export function joinPatterns(base, next) {
    base = typeof base === 'string' ? RoutePattern.parse(base) : base;
    next = typeof next === 'string' ? RoutePattern.parse(next) : next;
    return new RoutePattern({
        protocol: next.protocol ?? base.protocol,
        hostname: next.hostname ?? base.hostname,
        port: next.port ?? base.port,
        pathname: joinPathname(base.pathname, next.pathname),
        search: joinSearch(base.search, next.search),
    });
}
/**
 * Join two pathname parts, inserting a separator between them as needed.
 *
 * Trailing separator is stripped from `base`; leading separator is added to `next` if absent.
 *
 * ```text
 * 'a'   + 'b'   -> 'a/b'
 * 'a/'  + 'b'   -> 'a/b'
 * 'a'   + '/b'  -> 'a/b'
 * 'a/'  + '/b'  -> 'a/b'
 * '(a)' + '(b)' -> '(a)/(b)'
 * '(a/)'+ '(b)' -> '(a)/(b)'
 * '(a)' +'(/b)' -> '(a)(/b)'
 * '(a/)'+'(/b)' -> '(a)(/b)'
 * ```
 *
 * @private
 */
function joinPathname(base, next) {
    if (base.tokens.length === 0)
        return next;
    if (next.tokens.length === 0)
        return base;
    let tokens = [];
    // strip `base`'s trailing separator (only optionals after it)
    let baseLastNonOptionalIndex = base.tokens.findLastIndex((token) => token.type !== '(' && token.type !== ')');
    let baseLastNonOptional = base.tokens[baseLastNonOptionalIndex];
    let baseHasTrailingSeparator = baseLastNonOptional?.type === 'separator';
    base.tokens.forEach((token, index) => {
        if (index === baseLastNonOptionalIndex && token.type === 'separator')
            return;
        tokens.push(token);
    });
    // add separator if `next` has no leading one (only optionals before it)
    let nextFirstNonOptional = next.tokens.find((token) => token.type !== '(' && token.type !== ')');
    let needsSeparator = nextFirstNonOptional === undefined || nextFirstNonOptional.type !== 'separator';
    if (needsSeparator)
        tokens.push({ type: 'separator' });
    let tokenOffset = tokens.length;
    next.tokens.forEach((token) => tokens.push(token));
    let optionals = new Map();
    for (let [begin, end] of base.optionals) {
        if (baseHasTrailingSeparator) {
            // one less token before this optional since trailing slash token was omitted
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
/**
 * Merge two search constraint maps.
 *
 * ```text
 * '?a'   + '?b'   -> '?a&b'
 * '?a=1' + '?a=2' -> '?a=1&a=2'
 * '?a=1' + '?b=2' -> '?a=1&b=2'
 * ''     + '?a'   -> '?a'
 * ```
 *
 * @private
 */
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
