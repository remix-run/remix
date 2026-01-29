import { ParseError, unreachable } from "../errors.js";
import * as RE from "../regexp.js";
import { Variant } from "../variant.js";
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/;
export class PartPattern {
    tokens;
    paramNames;
    optionals;
    type;
    ignoreCase;
    #variants;
    #regexp;
    constructor(ast, options) {
        this.tokens = ast.tokens;
        this.paramNames = ast.paramNames;
        this.optionals = ast.optionals;
        this.type = options.type;
        this.ignoreCase = options.ignoreCase;
    }
    get separator() {
        return separatorForType(this.type);
    }
    static parse(source, options) {
        let span = options.span ?? [0, source.length];
        let separator = separatorForType(options.type);
        let ast = {
            tokens: [],
            paramNames: [],
            optionals: new Map(),
        };
        let appendText = (text) => {
            let currentToken = ast.tokens.at(-1);
            if (currentToken?.type === 'text') {
                currentToken.text += text;
            }
            else {
                ast.tokens.push({ type: 'text', text });
            }
        };
        let i = span[0];
        let optionalStack = [];
        while (i < span[1]) {
            let char = source[i];
            // optional begin
            if (char === '(') {
                optionalStack.push(ast.tokens.length);
                ast.tokens.push({ type: char });
                i += 1;
                continue;
            }
            // optional end
            if (char === ')') {
                let begin = optionalStack.pop();
                if (begin === undefined) {
                    throw new ParseError('unmatched )', source, i);
                }
                ast.optionals.set(begin, ast.tokens.length);
                ast.tokens.push({ type: char });
                i += 1;
                continue;
            }
            // variable
            if (char === ':') {
                i += 1;
                let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0];
                if (!name) {
                    throw new ParseError('missing variable name', source, i - 1);
                }
                ast.tokens.push({ type: ':', nameIndex: ast.paramNames.length });
                ast.paramNames.push(name);
                i += name.length;
                continue;
            }
            // wildcard
            if (char === '*') {
                i += 1;
                let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0];
                ast.tokens.push({ type: '*', nameIndex: ast.paramNames.length });
                ast.paramNames.push(name ?? '*');
                i += name?.length ?? 0;
                continue;
            }
            if (separator && char === separator) {
                ast.tokens.push({ type: 'separator' });
                i += 1;
                continue;
            }
            // escaped char
            if (char === '\\') {
                if (i + 1 === span[1]) {
                    throw new ParseError('dangling escape', source, i);
                }
                let text = source.slice(i, i + 2);
                appendText(text);
                i += text.length;
                continue;
            }
            // text
            appendText(char);
            i += 1;
        }
        if (optionalStack.length > 0) {
            throw new ParseError('unmatched (', source, optionalStack.at(-1));
        }
        return new PartPattern(ast, { type: options.type, ignoreCase: options.ignoreCase });
    }
    get variants() {
        if (this.#variants === undefined) {
            this.#variants = Variant.generate(this);
        }
        return this.#variants;
    }
    get source() {
        let result = '';
        for (let token of this.tokens) {
            if (token.type === '(' || token.type === ')') {
                result += token.type;
                continue;
            }
            if (token.type === 'text') {
                result += token.text;
                continue;
            }
            if (token.type === ':' || token.type === '*') {
                let name = this.paramNames[token.nameIndex];
                if (name === '*')
                    name = '';
                result += `${token.type}${name}`;
                continue;
            }
            if (token.type === 'separator') {
                result += this.separator;
                continue;
            }
            unreachable(token.type);
        }
        return result;
    }
    toString() {
        return this.source;
    }
    /**
     * @param params The parameters to substitute into the pattern.
     * @returns The href (URL) for the given params, or null if no variant matches.
     */
    href(params) {
        let best;
        for (let variant of this.variants) {
            let matches = variant.requiredParams.every((param) => params[param] !== undefined);
            if (!matches)
                continue;
            if (best === undefined) {
                best = variant;
                continue;
            }
            if (variant.requiredParams.length > best.requiredParams.length) {
                best = variant;
                continue;
            }
            if (variant.requiredParams.length === best.requiredParams.length) {
                if (variant.tokens.length > best.tokens.length) {
                    best = variant;
                    continue;
                }
            }
        }
        // todo: I can't think of any case where there would end up being a tie
        // but the logic doesn't explicitly rule it out.
        // need to figure out if its possible and how to handle it.
        if (!best)
            return null;
        let result = '';
        for (let token of best.tokens) {
            if (token.type === 'text') {
                result += token.text;
                continue;
            }
            if (token.type === ':' || token.type === '*') {
                let paramName = this.paramNames[token.nameIndex];
                result += String(params[paramName]);
                continue;
            }
            if (token.type === 'separator') {
                result += this.separator;
                continue;
            }
            unreachable(token.type);
        }
        return result;
    }
    match(part) {
        if (this.#regexp === undefined) {
            this.#regexp = toRegExp(this.tokens, this.separator, this.ignoreCase);
        }
        let reMatch = this.#regexp.exec(part);
        if (reMatch === null)
            return null;
        let match = [];
        for (let group in reMatch.indices?.groups) {
            let prefix = group[0];
            let nameIndex = parseInt(group.slice(1));
            if (prefix !== 'v' && prefix !== 'w')
                continue;
            let type = prefix === 'v' ? ':' : '*';
            let span = reMatch.indices.groups[group];
            if (span === undefined)
                continue;
            match.push({
                type,
                name: this.paramNames[nameIndex],
                begin: span[0],
                end: span[1],
                value: reMatch.groups[group],
            });
        }
        return match;
    }
}
function toRegExp(tokens, separator, ignoreCase) {
    let result = '';
    for (let token of tokens) {
        if (token.type === 'text') {
            result += RE.escape(token.text);
            continue;
        }
        if (token.type === ':') {
            result += `(?<v${token.nameIndex}>`;
            result += separator ? `[^${separator}]+?` : `.+?`;
            result += `)`;
            continue;
        }
        if (token.type === '*') {
            result += `(?<w${token.nameIndex}>.*)`;
            continue;
        }
        if (token.type === '(') {
            result += '(?:';
            continue;
        }
        if (token.type === ')') {
            result += ')?';
            continue;
        }
        if (token.type === 'separator') {
            result += RE.escape(separator ?? '');
            continue;
        }
        unreachable(token.type);
    }
    return new RegExp(`^${result}$`, ignoreCase ? 'di' : 'd');
}
function separatorForType(type) {
    if (type === 'hostname')
        return '.';
    return '/';
}
