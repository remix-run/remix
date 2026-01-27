import { split } from "./split.js";
import { parseSearchConstraints } from "./search-constraints.js";
/**
 * An error thrown when a pattern fails to parse.
 */
export class ParseError extends Error {
    /**
     * The source pattern that failed to parse.
     */
    source;
    /**
     * The position in the source where the error occurred.
     */
    position;
    /**
     * The name of the part being parsed (e.g., "pathname", "hostname").
     */
    partName;
    /**
     * @param description A description of the error
     * @param partName The name of the part being parsed
     * @param source The source pattern
     * @param position The position in the source where the error occurred
     */
    constructor(description, partName, source, position) {
        super(`${description} in ${partName}`);
        this.name = 'ParseError';
        this.source = source;
        this.position = position;
        this.partName = partName;
    }
}
export function parse(source) {
    let protocol;
    let hostname;
    let port;
    let pathname;
    let search;
    let searchConstraints;
    let ranges = split(source);
    if (ranges.protocol) {
        protocol = parsePart('protocol', '', source, ...ranges.protocol);
    }
    if (ranges.hostname) {
        hostname = parsePart('hostname', '.', source, ...ranges.hostname);
    }
    if (ranges.port) {
        port = source.slice(...ranges.port);
    }
    if (ranges.pathname) {
        pathname = parsePart('pathname', '/', source, ...ranges.pathname);
    }
    if (ranges.search) {
        search = source.slice(...ranges.search);
        searchConstraints = parseSearchConstraints(search);
    }
    return { protocol, hostname, port, pathname, search, searchConstraints };
}
const identifierMatcher = /^[a-zA-Z_$][a-zA-Z_$0-9]*/;
function parsePart(partName, sep, source, start, end) {
    let tokens = [];
    let currentTokens = tokens;
    // Use a simple stack of token arrays: the top is where new tokens are appended.
    // The root of the stack is the `part` array. Each '(' pushes a new array; ')'
    // pops and wraps it in an optional token which is appended to the new top.
    let tokensStack = [tokens];
    let openIndexes = [];
    let appendText = (text) => {
        let lastToken = currentTokens.at(-1);
        if (lastToken?.type === 'text') {
            lastToken.value += text;
        }
        else {
            currentTokens.push({ type: 'text', value: text });
        }
    };
    let i = start;
    while (i < end) {
        let char = source[i];
        // separator
        if (char === sep) {
            currentTokens.push({ type: 'separator' });
            i += 1;
            continue;
        }
        // variable
        if (char === ':') {
            i += 1;
            let remaining = source.slice(i, end);
            let name = identifierMatcher.exec(remaining)?.[0];
            if (!name)
                throw new ParseError('missing variable name', partName, source, i);
            currentTokens.push({ type: 'variable', name });
            i += name.length;
            continue;
        }
        // wildcard
        if (char === '*') {
            i += 1;
            let remaining = source.slice(i, end);
            let name = identifierMatcher.exec(remaining)?.[0];
            if (name) {
                currentTokens.push({ type: 'wildcard', name });
                i += name.length;
            }
            else {
                currentTokens.push({ type: 'wildcard' });
            }
            continue;
        }
        // optional
        if (char === '(') {
            tokensStack.push((currentTokens = []));
            openIndexes.push(i);
            i += 1;
            continue;
        }
        if (char === ')') {
            if (tokensStack.length === 1)
                throw new ParseError('unmatched )', partName, source, i);
            let tokens = tokensStack.pop();
            currentTokens = tokensStack[tokensStack.length - 1];
            currentTokens.push({ type: 'optional', tokens });
            openIndexes.pop();
            i += 1;
            continue;
        }
        // text
        if (char === '\\') {
            let next = source.at(i + 1);
            if (!next || i + 1 >= end)
                throw new ParseError('dangling escape', partName, source, i);
            appendText(next);
            i += 2;
            continue;
        }
        appendText(char);
        i += 1;
    }
    if (openIndexes.length > 0) {
        // Report the position of the earliest unmatched '('
        throw new ParseError('unmatched (', partName, source, openIndexes[0]);
    }
    return tokens;
}
