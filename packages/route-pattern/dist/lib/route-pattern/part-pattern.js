import { ParseError } from "./parse.js";
import { unreachable } from "../unreachable.js";
import * as RE from "../regexp.js";
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/;
export class PartPattern {
    tokens;
    optionals;
    type;
    ignoreCase;
    #regexp;
    constructor(args, options) {
        this.tokens = args.tokens;
        this.optionals = args.optionals;
        this.type = options.type;
        this.ignoreCase = options.ignoreCase;
    }
    get params() {
        let result = [];
        for (let token of this.tokens) {
            if (token.type === ':' || token.type === '*') {
                result.push(token);
            }
        }
        return result;
    }
    get separator() {
        return separatorForType(this.type);
    }
    static parse(source, options) {
        let span = options.span ?? [0, source.length];
        let separator = separatorForType(options.type);
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
            // optional begin
            if (char === '(') {
                optionalStack.push(tokens.length);
                tokens.push({ type: char });
                i += 1;
                continue;
            }
            // optional end
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
            // variable
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
            // wildcard
            if (char === '*') {
                i += 1;
                let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0];
                tokens.push({ type: '*', name: name ?? '*' });
                i += name?.length ?? 0;
                continue;
            }
            if (separator && char === separator) {
                tokens.push({ type: 'separator' });
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
        return new PartPattern({ tokens, optionals }, { type: options.type, ignoreCase: options.ignoreCase });
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
                let name = token.name === '*' ? '' : token.name;
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
    match(part) {
        if (this.#regexp === undefined) {
            this.#regexp = toRegExp(this.tokens, this.separator, this.ignoreCase);
        }
        let reMatch = this.#regexp.exec(part);
        if (reMatch === null)
            return null;
        let match = [];
        let params = this.params;
        for (let i = 0; i < params.length; i++) {
            let param = params[i];
            let captureIndex = i + 1;
            let span = reMatch.indices?.[captureIndex];
            if (span === undefined)
                continue;
            match.push({
                type: param.type,
                name: param.name,
                begin: span[0],
                end: span[1],
                value: reMatch[captureIndex],
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
            result += separator ? `([^${separator}]+?)` : `(.+?)`;
            continue;
        }
        if (token.type === '*') {
            result += `(.*)`;
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
