import { PartPattern } from "./part-pattern.js";
export function parseProtocol(source, span) {
    if (!span)
        return null;
    let protocol = source.slice(...span);
    if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
        return protocol === '' ? null : protocol;
    }
    throw new ParseError('invalid protocol', source, span[0]);
}
export function parseHostname(source, span) {
    if (!span)
        return null;
    let part = PartPattern.parse(source, { span, type: 'hostname' });
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
export function parseSearch(source) {
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
/**
 * Error thrown when a route pattern cannot be parsed.
 */
export class ParseError extends Error {
    /**
     * The parse failure category.
     */
    type;
    /**
     * Original pattern source being parsed.
     */
    source;
    /**
     * Character index where parsing failed.
     */
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
