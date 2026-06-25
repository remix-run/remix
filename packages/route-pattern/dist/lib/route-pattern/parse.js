import { split } from "./split.js";
import { RoutePattern } from "../route-pattern.js";
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/;
/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {ParseError} When the source is malformed.
 */
export function parsePattern(source) {
    let spans = split(source);
    return new RoutePattern({
        protocol: parseProtocol(source, spans.protocol),
        hostname: parseHostname(source, spans.hostname),
        port: spans.port ? source.slice(...spans.port) : null,
        pathname: spans.pathname
            ? parsePart(source, { span: spans.pathname, type: 'pathname' })
            : parsePart('', { span: [0, 0], type: 'pathname' }),
        search: spans.search ? parseSearch(source.slice(...spans.search)) : new Map(),
    });
}
/**
 * Parse a single URL part (hostname or pathname).
 *
 * @private
 */
export function parsePart(source, options) {
    let span = options.span ?? [0, source.length];
    let separator = options.type === 'hostname' ? '.' : '/';
    let tokens = [];
    let optionals = new Map();
    let appendText = (text) => {
        let currentToken = tokens.at(-1);
        if (currentToken?.type === 'text') {
            currentToken.text += text;
        }
        else {
            tokens.push({ type: 'text', text });
        }
    };
    let i = span[0];
    let optionalStack = [];
    while (i < span[1]) {
        let char = source[i];
        if (char === '(') {
            optionalStack.push(tokens.length);
            tokens.push({ type: char });
            i += 1;
            continue;
        }
        if (char === ')') {
            let begin = optionalStack.pop();
            if (begin === undefined) {
                throw new ParseError('unmatched )', source, i);
            }
            optionals.set(begin, tokens.length);
            tokens.push({ type: char });
            i += 1;
            continue;
        }
        if (char === ':') {
            i += 1;
            let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0];
            if (!name) {
                throw new ParseError('missing variable name', source, i - 1);
            }
            tokens.push({ type: ':', name });
            i += name.length;
            continue;
        }
        if (char === '*') {
            i += 1;
            let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0];
            tokens.push({ type: '*', name: name ?? '*' });
            i += name?.length ?? 0;
            continue;
        }
        if (char === separator) {
            tokens.push({ type: 'separator' });
            i += 1;
            continue;
        }
        if (char === '\\') {
            if (i + 1 === span[1]) {
                throw new ParseError('dangling escape', source, i);
            }
            let text = source.slice(i + 1, i + 2);
            appendText(text);
            i += 2;
            continue;
        }
        appendText(char);
        i += 1;
    }
    if (optionalStack.length > 0) {
        throw new ParseError('unmatched (', source, optionalStack.at(-1));
    }
    return { tokens, optionals, type: options.type };
}
function parseProtocol(source, span) {
    if (!span)
        return null;
    let protocol = source.slice(...span);
    if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
        return protocol === '' ? null : protocol;
    }
    throw new ParseError('invalid protocol', source, span[0]);
}
function parseHostname(source, span) {
    if (!span)
        return null;
    let part = parsePart(source, { span, type: 'hostname' });
    if (isNamelessWildcard(part))
        return null;
    return part;
}
function isNamelessWildcard(part) {
    if (part.tokens.length !== 1)
        return false;
    let token = part.tokens[0];
    if (token.type !== '*')
        return false;
    return token.name === '*';
}
function parseSearch(source) {
    let constraints = new Map();
    let searchParams = new URLSearchParams(source);
    for (let [key, value] of searchParams) {
        let requiredValues = constraints.get(key);
        if (!requiredValues) {
            requiredValues = new Set();
            constraints.set(key, requiredValues);
        }
        if (value === '')
            continue;
        requiredValues.add(value);
    }
    return constraints;
}
/** Error thrown when a route pattern cannot be parsed. */
export class ParseError extends Error {
    /** The parse failure category. */
    type;
    /** Original pattern source being parsed. */
    source;
    /** Character index where parsing failed. */
    index;
    constructor(type, source, index) {
        let underline = ' '.repeat(index) + '^';
        let message = `${type}\n\n${source}\n${underline}`;
        super(message);
        this.name = 'ParseError';
        this.type = type;
        this.source = source;
        this.index = index;
    }
}
