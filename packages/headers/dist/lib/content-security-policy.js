/**
 * A single Content Security Policy, independent of routing and nonce generation.
 * Comma-separated policy lists must be handled as separate policies.
 */
export class ContentSecurityPolicy {
    #directives = new Map();
    constructor(init) {
        if (typeof init === 'string') {
            if (init.includes(',')) {
                throw new TypeError('Expected a single Content Security Policy, not a policy list');
            }
            for (let directive of init.split(';')) {
                let tokens = directive.split(/[\t\n\f\r ]+/).filter(Boolean);
                let name = tokens.shift()?.toLowerCase();
                // The first occurrence wins, including an empty source list.
                if (name && !this.#directives.has(name))
                    this.set(name, tokens);
            }
        }
        else if (init instanceof ContentSecurityPolicy) {
            for (let [name, values] of init.#directives)
                this.set(name, values);
        }
        else if (init != null) {
            for (let [name, values] of Object.entries(init)) {
                if (values === undefined || values === false)
                    continue;
                let directive = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
                this.set(directive, typeof values === 'string' ? [values] : values === true ? [] : values);
            }
        }
    }
    /**
     * Reads a directive by its case-insensitive, hyphenated name.
     * @param name Directive name, such as `script-src`.
     * @returns A copy of the tokens, or undefined when the directive is absent.
     */
    get(name) {
        let values = this.#directives.get(name.toLowerCase());
        return values === undefined ? undefined : [...values];
    }
    /**
     * Sets a directive, including extension directives. Tokens cannot contain whitespace or delimiters.
     * `report-to` requires exactly one HTTP token naming a reporting endpoint.
     * @param name Case-insensitive, hyphenated directive name.
     * @param values Individual CSP tokens; an empty array emits a valueless directive.
     */
    set(name, values) {
        if (!/^[a-zA-Z0-9-]+$/.test(name))
            throw new TypeError(`Invalid CSP directive: ${name}`);
        name = name.toLowerCase();
        if (name === 'report-to') {
            if (values.length !== 1)
                throw new TypeError('CSP report-to requires exactly one endpoint');
            if (!/^[!#$%&'*+.^_`|~a-zA-Z0-9-]+$/.test(values[0])) {
                throw new TypeError(`Invalid CSP report-to endpoint: ${values[0]}`);
            }
        }
        for (let value of values) {
            if (!/^[\x21-\x2b\x2d-\x3a\x3c-\x7e]+$/.test(value)) {
                throw new TypeError(`Invalid CSP directive token: ${value}`);
            }
        }
        this.#directives.set(name, [...values]);
    }
    /**
     * Removes a directive by its case-insensitive, hyphenated name.
     * @param name Directive to remove.
     */
    delete(name) {
        this.#directives.delete(name.toLowerCase());
    }
    /**
     * Serializes the policy without changing directive values or merging policies.
     * @returns A value suitable for a CSP or CSP report-only header.
     */
    toString() {
        return [...this.#directives].map(([name, values]) => [name, ...values].join(' ')).join('; ');
    }
    /**
     * Parses or copies a single policy.
     * @param value Serialized policy, directive object, existing policy, or null.
     * @returns A new policy, empty when value is null.
     */
    static from(value) {
        return new ContentSecurityPolicy(value ?? undefined);
    }
}
