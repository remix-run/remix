import { ParseError } from "./parse.js";
import { unreachable } from "../unreachable.js";
import * as RE from "../regexp.js";
import { HrefError } from "./href.js";
const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/;
export class PartPattern {
    tokens;
    optionals;
    type;
    #regexp;
    constructor(args, options) {
        this.tokens = args.tokens;
        this.optionals = args.optionals;
        this.type = options.type;
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
        return new PartPattern({ tokens, optionals }, { type: options.type });
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
    /**
     * Generate a partial href from a part pattern and params.
     *
     * @param pattern The route pattern containing the part pattern.
     * @param params The parameters to substitute into the pattern.
     * @returns The partial href for the given params
     */
    href(pattern, params) {
        let missingParams = [];
        let stack = [{ href: '' }];
        let i = 0;
        while (i < this.tokens.length) {
            let token = this.tokens[i];
            if (token.type === 'text') {
                stack[stack.length - 1].href += token.text;
                i += 1;
                continue;
            }
            if (token.type === 'separator') {
                stack[stack.length - 1].href += this.separator;
                i += 1;
                continue;
            }
            if (token.type === '(') {
                stack.push({ begin: i, href: '' });
                i += 1;
                continue;
            }
            if (token.type === ')') {
                let frame = stack.pop();
                stack[stack.length - 1].href += frame.href;
                i += 1;
                continue;
            }
            if (token.type === ':' || token.type === '*') {
                let value = params[token.name];
                if (value === undefined) {
                    if (stack.length <= 1) {
                        if (token.name === '*') {
                            throw new HrefError({
                                type: 'nameless-wildcard',
                                pattern,
                            });
                        }
                        missingParams.push(token.name);
                    }
                    let frame = stack.pop();
                    i = this.optionals.get(frame.begin) + 1;
                    continue;
                }
                stack[stack.length - 1].href += this.#encodeParamHref(pattern, token, value);
                i += 1;
                continue;
            }
            unreachable(token.type);
        }
        if (missingParams.length > 0) {
            throw new HrefError({
                type: 'missing-params',
                pattern,
                partPattern: this,
                missingParams,
                params,
            });
        }
        if (stack.length !== 1)
            unreachable();
        return stack[0].href;
    }
    #encodeParamHref(pattern, token, value) {
        let stringValue = typeof value === 'string' ? value : String(value);
        if (this.type === 'pathname') {
            return token.type === '*'
                ? stringValue
                    .split('/')
                    .map((segment) => this.#encodePathnameSegment(pattern, token, stringValue, segment))
                    .join('/')
                : this.#encodePathnameSegment(pattern, token, stringValue, stringValue);
        }
        let result = encodeHostnameParam(pattern, this, token.name, stringValue);
        if (token.type === ':' && result.includes('.')) {
            throw new HrefError({
                type: 'invalid-param',
                pattern,
                partPattern: this,
                paramName: token.name,
                paramValue: stringValue,
                reason: 'hostname variable params must not contain hostname separators',
            });
        }
        return result;
    }
    #encodePathnameSegment(pattern, token, stringValue, segment) {
        if (segment === '.' || segment === '..') {
            throw new HrefError({
                type: 'invalid-param',
                pattern,
                partPattern: this,
                paramName: token.name,
                paramValue: stringValue,
                reason: 'pathname params must not contain dot segments',
            });
        }
        return encodePathnameSegment(segment);
    }
    match(part, options) {
        let ignoreCase = options?.ignoreCase ?? false;
        if (this.#regexp === undefined) {
            this.#regexp = this.#toRegExp();
        }
        let regexp = ignoreCase ? this.#regexp.caseInsensitive : this.#regexp.caseSensitive;
        let reMatch = regexp.exec(part);
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
    #toRegExp() {
        if (this.#regexp !== undefined)
            return this.#regexp;
        let result = '';
        for (let token of this.tokens) {
            if (token.type === 'text') {
                result += RE.escape(token.text);
                continue;
            }
            if (token.type === ':') {
                result += this.separator ? `([^${this.separator}]+?)` : `(.+?)`;
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
                result += RE.escape(this.separator ?? '');
                continue;
            }
            unreachable(token.type);
        }
        let source = `^${result}$`;
        this.#regexp = {
            caseSensitive: new RegExp(source, 'd'),
            caseInsensitive: new RegExp(source, 'di'),
        };
        return this.#regexp;
    }
}
function separatorForType(type) {
    if (type === 'hostname')
        return '.';
    return '/';
}
function encodePathnameSegment(value) {
    return encodeURIComponent(value).replace(/%(?:24|26|2B|2C|3A|3B|3D|40)/g, function preservePathnameSegmentChar(match) {
        return String.fromCharCode(Number.parseInt(match.slice(1), 16));
    });
}
const hostnameNormalizationSuffix = '.route-pattern.invalid';
function encodeHostnameParam(pattern, partPattern, paramName, value) {
    let url;
    try {
        url = new URL(`https://${value}${hostnameNormalizationSuffix}/`);
    }
    catch {
        throw new HrefError({
            type: 'invalid-param',
            pattern,
            partPattern,
            paramName,
            paramValue: value,
            reason: 'hostname params must be valid URL hostname content',
        });
    }
    if (url.username !== '' || url.password !== '') {
        throw new HrefError({
            type: 'invalid-param',
            pattern,
            partPattern,
            paramName,
            paramValue: value,
            reason: 'hostname params must not contain URL username or password separators',
        });
    }
    if (url.pathname !== '/' ||
        url.search !== '' ||
        url.hash !== '' ||
        !url.hostname.endsWith(hostnameNormalizationSuffix)) {
        throw new HrefError({
            type: 'invalid-param',
            pattern,
            partPattern,
            paramName,
            paramValue: value,
            reason: 'hostname params must not contain URL path, query, or hash separators',
        });
    }
    return url.hostname.slice(0, -hostnameNormalizationSuffix.length);
}
