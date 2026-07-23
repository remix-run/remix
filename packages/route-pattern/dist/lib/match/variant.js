import { escape } from "./regexp.js";
import { unreachable } from "../unreachable.js";
import { toRegExp } from "./regexp.js";
export function generateVariants(pattern, options) {
    let patternParts = pattern._parts;
    let result = [];
    for (let protocol of generateProtocolVariants(patternParts.protocol)) {
        let port = normalizePort(protocol, patternParts.port);
        for (let hostname of generateHostnameVariants(patternParts.hostname)) {
            for (let pathname of generatePathnameVariants(patternParts.pathname, options)) {
                result.push({ protocol, hostname, port, pathname });
            }
        }
    }
    return result;
}
function generateProtocolVariants(protocol) {
    if (protocol === null || protocol === 'http(s)')
        return ['http', 'https'];
    return [protocol];
}
function normalizePort(protocol, port) {
    if (port === null)
        return '';
    if (protocol === 'http' && port === '80')
        return '';
    if (protocol === 'https' && port === '443')
        return '';
    return port;
}
function toParams(tokens) {
    let params = [];
    for (let token of tokens) {
        if (token.type === ':' || token.type === '*') {
            params.push(token);
        }
    }
    return params;
}
function generateHostnameVariants(hostname) {
    let result = [];
    if (hostname === null)
        return [{ type: 'any' }];
    for (let variant of generatePartVariants(hostname)) {
        let params = toParams(variant);
        if (params.length > 0) {
            result.push({
                type: 'dynamic',
                params,
                regexp: toRegExp(variant, { separator: '.', ignoreCase: false }),
            });
        }
        else {
            result.push({ type: 'static', value: stringifyStatic(variant, '.') });
        }
    }
    return result;
}
function stringifyStatic(variant, separator) {
    let result = '';
    for (let token of variant) {
        if (token.type === 'text')
            result += token.text;
        else if (token.type === 'separator')
            result += separator;
        else
            throw new Error(`expected static part variant, got token type '${token.type}'`);
    }
    return result;
}
function generatePathnameVariants(pathname, options) {
    let result = [];
    let ignoreCase = options?.ignoreCase ?? false;
    for (let tokens of generatePartVariants(pathname)) {
        let variant = [];
        let key = '';
        let reSource = '';
        let reFlags = ignoreCase ? 'di' : 'd';
        let type = 'static';
        let params = [];
        for (let token of tokens) {
            if (token.type === 'separator') {
                if (type === 'static') {
                    variant.push({ type: 'static', key: ignoreCase ? key.toLowerCase() : key });
                    key = '';
                    reSource = '';
                    continue;
                }
                if (type === 'variable') {
                    variant.push({
                        type: 'variable',
                        key,
                        regexp: new RegExp(`^${reSource}$`, reFlags),
                        params,
                    });
                    key = '';
                    reSource = '';
                    params = [];
                    type = 'static';
                    continue;
                }
                if (type === 'wildcard') {
                    key += '/';
                    reSource += escape('/');
                    continue;
                }
                unreachable(type);
            }
            if (token.type === 'text') {
                // Encode to comply with URL pathname normalization in trie matcher
                let text = encodeURIComponent(ignoreCase ? token.text.toLowerCase() : token.text);
                key += text;
                reSource += escape(text);
                continue;
            }
            if (token.type === ':') {
                key += '{:}';
                reSource += `([^/]+)`;
                params.push(token);
                if (type === 'static')
                    type = 'variable';
                continue;
            }
            if (token.type === '*') {
                key += '{*}';
                reSource += `(.*)`;
                params.push(token);
                type = 'wildcard';
                continue;
            }
            unreachable(token.type);
        }
        if (type === 'static') {
            variant.push({ type: 'static', key: ignoreCase ? key.toLowerCase() : key });
        }
        if (type === 'variable' || type === 'wildcard') {
            variant.push({ type, key, regexp: new RegExp(`^${reSource}$`, reFlags), params });
        }
        result.push(variant);
    }
    return result;
}
/**
 * Expand a part pattern's optionals into the list of all concrete variants.
 *
 * Each variant is the linear token sequence you'd get by independently choosing
 * to include or omit every `(` `)` group. No nesting, no optional markers.
 *
 * @private
 */
export function generatePartVariants(part) {
    let result = [];
    let seen = new Set();
    let stack = [{ index: 0, tokens: [] }];
    while (stack.length > 0) {
        let { index, tokens } = stack.pop();
        if (index === part.tokens.length) {
            let key = partVariantKey(tokens);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(tokens);
            }
            continue;
        }
        let token = part.tokens[index];
        if (token.type === '(') {
            stack.push({ index: index + 1, tokens }, { index: part.optionals.get(index) + 1, tokens: tokens.slice() });
            continue;
        }
        if (token.type === ')') {
            stack.push({ index: index + 1, tokens });
            continue;
        }
        if (token.type === ':' ||
            token.type === '*' ||
            token.type === 'text' ||
            token.type === 'separator') {
            tokens.push(token);
            stack.push({ index: index + 1, tokens });
            continue;
        }
        unreachable(token.type);
    }
    return result;
}
function partVariantKey(tokens) {
    return tokens
        .map((token) => {
        if (token.type === 'text')
            return `text:${JSON.stringify(token.text)}`;
        if (token.type === ':' || token.type === '*')
            return `${token.type}:${token.name}`;
        return token.type;
    })
        .join('|');
}
