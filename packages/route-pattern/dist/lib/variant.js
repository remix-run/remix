import { unreachable } from "./errors.js";
export class Variant {
    /** Params use `nameIndex` to reference params in the PartPattern's `paramNames` */
    tokens;
    #partPattern;
    #requiredParams;
    constructor(partPattern, tokens) {
        this.#partPattern = partPattern;
        this.tokens = tokens;
    }
    get requiredParams() {
        if (this.#requiredParams === undefined) {
            this.#requiredParams = [];
            for (let token of this.tokens) {
                if (token.type === ':' || token.type === '*') {
                    this.#requiredParams.push(this.#partPattern.paramNames[token.nameIndex]);
                }
            }
        }
        return this.#requiredParams;
    }
    static generate(pattern) {
        let result = [];
        let stack = [{ index: 0, tokens: [] }];
        while (stack.length > 0) {
            let { index, tokens } = stack.pop();
            if (index === pattern.tokens.length) {
                result.push(new Variant(pattern, tokens));
                continue;
            }
            let token = pattern.tokens[index];
            if (token.type === '(') {
                stack.push({ index: index + 1, tokens }, { index: pattern.optionals.get(index) + 1, tokens: tokens.slice() });
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
    toString() {
        let result = '';
        for (let token of this.tokens) {
            if (token.type === 'text') {
                result += token.text;
                continue;
            }
            if (token.type === ':' || token.type === '*') {
                let name = this.#partPattern.paramNames[token.nameIndex];
                if (name === '*')
                    name = '';
                result += `{${token.type}${name}}`;
                continue;
            }
            if (token.type === 'separator') {
                result += this.#partPattern.separator;
                continue;
            }
            unreachable(token.type);
        }
        return result;
    }
}
