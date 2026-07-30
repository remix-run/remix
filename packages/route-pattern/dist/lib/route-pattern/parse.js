import { split } from "./split.js";
import { createRoutePattern } from "../route-pattern.js";
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
    if (spans.port && !spans.hostname) {
        throw new ParseError('missing hostname', source, spans.port[0] - 1);
    }
    return createRoutePattern({
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
    let tokenIndices = [];
    let optionals = new Map();
    let appendText = (text) => {
        let currentToken = tokens.at(-1);
        if (currentToken?.type === 'text') {
            currentToken.text += text;
        }
        else {
            tokens.push({ type: 'text', text });
            tokenIndices.push(i);
        }
    };
    let i = span[0];
    let optionalStack = [];
    let emptyOptionals = [];
    while (i < span[1]) {
        let char = source[i];
        if (char === '(') {
            optionalStack.push({ tokenIndex: tokens.length, sourceIndex: i });
            tokens.push({ type: char });
            tokenIndices.push(i);
            i += 1;
            continue;
        }
        if (char === ')') {
            let optional = optionalStack.pop();
            if (optional === undefined) {
                throw new ParseError('unmatched )', source, i);
            }
            if (optional.tokenIndex === tokens.length - 1) {
                emptyOptionals.push(optional.sourceIndex);
            }
            optionals.set(optional.tokenIndex, tokens.length);
            tokens.push({ type: char });
            tokenIndices.push(i);
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
            tokenIndices.push(i - 1);
            i += name.length;
            continue;
        }
        if (char === '*') {
            i += 1;
            let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0];
            tokens.push({ type: '*', name: name ?? '*' });
            tokenIndices.push(i - 1);
            i += name?.length ?? 0;
            continue;
        }
        if (char === separator) {
            tokens.push({ type: 'separator' });
            tokenIndices.push(i);
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
    let unmatchedOptional = optionalStack.at(-1);
    if (unmatchedOptional !== undefined) {
        throw new ParseError('unmatched (', source, unmatchedOptional.sourceIndex);
    }
    if (emptyOptionals.length > 0) {
        throw new ParseError('empty optional', source, emptyOptionals[0]);
    }
    validateTokenGrammar(source, tokens, optionals, tokenIndices);
    validateOptionalCaptureSchemas(source, tokens, optionals, tokenIndices);
    return { tokens, optionals, type: options.type };
}
function validateTokenGrammar(source, tokens, optionals, tokenIndices) {
    for (let [index, token] of tokens.entries()) {
        if (token.type !== ':' && token.type !== '*')
            continue;
        for (let next of nextConsumingTokenIndices(tokens, optionals, index + 1)) {
            if (next === tokens.length)
                continue;
            let nextToken = tokens[next];
            if (token.type === '*') {
                if (nextToken.type === '*') {
                    throw new ParseError('adjacent wildcards', source, tokenIndices[next]);
                }
                continue;
            }
            if (nextToken.type === 'separator' ||
                nextToken.type === '*' ||
                (nextToken.type === 'text' && nextToken.text.startsWith('.'))) {
                continue;
            }
            throw new ParseError('invalid param delimiter', source, tokenIndices[next]);
        }
    }
}
function nextConsumingTokenIndices(tokens, optionals, start) {
    let result = new Set();
    let pending = [start];
    let visited = new Set();
    while (pending.length > 0) {
        let index = pending.pop();
        if (index === undefined)
            break;
        if (visited.has(index))
            continue;
        visited.add(index);
        let token = tokens[index];
        if (token === undefined) {
            result.add(tokens.length);
        }
        else if (token.type === '(') {
            let end = optionals.get(index);
            if (end === undefined)
                throw new Error('missing optional end');
            pending.push(index + 1, end + 1);
        }
        else if (token.type === ')') {
            pending.push(index + 1);
        }
        else {
            result.add(index);
        }
    }
    return result;
}
function validateOptionalCaptureSchemas(source, tokens, optionals, tokenIndices) {
    for (let [begin, end] of optionals) {
        let nextBegin = end + 1;
        if (tokens[nextBegin]?.type !== '(')
            continue;
        let nextEnd = optionals.get(nextBegin);
        if (nextEnd === undefined)
            continue;
        let first = optionalStructure(tokens, begin + 1, end);
        let second = optionalStructure(tokens, nextBegin + 1, nextEnd);
        if (first.structure === second.structure && first.captures !== second.captures) {
            throw new ParseError('ambiguous optional captures', source, tokenIndices[nextBegin]);
        }
    }
}
function optionalStructure(tokens, begin, end) {
    let structure = '';
    let captures = '';
    for (let i = begin; i < end; i++) {
        let token = tokens[i];
        if (token.type === ':' || token.type === '*') {
            structure += token.type;
            captures += `${token.type}:${token.name}|`;
        }
        else if (token.type === 'text') {
            structure += `t:${token.text}|`;
        }
        else {
            structure += `${token.type}|`;
        }
    }
    return { structure, captures };
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
