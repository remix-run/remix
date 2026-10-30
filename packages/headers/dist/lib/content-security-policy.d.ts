import type { HeaderValue } from './header-value.ts';
/** Directives for a single Content Security Policy. Values are individual CSP tokens, including quotes. */
export interface ContentSecurityPolicyInit {
    /** Fallback sources for fetch directives. */
    defaultSrc?: readonly string[];
    /** Allowed script sources. */
    scriptSrc?: readonly string[];
    /** Allowed sources for script elements. */
    scriptSrcElem?: readonly string[];
    /** Allowed inline script attributes. */
    scriptSrcAttr?: readonly string[];
    /** Allowed stylesheet sources. */
    styleSrc?: readonly string[];
    /** Allowed sources for style elements. */
    styleSrcElem?: readonly string[];
    /** Allowed inline style attributes. */
    styleSrcAttr?: readonly string[];
    /** Allowed image sources. */
    imgSrc?: readonly string[];
    /** Allowed font sources. */
    fontSrc?: readonly string[];
    /** Allowed network connection destinations. */
    connectSrc?: readonly string[];
    /** Allowed audio and video sources. */
    mediaSrc?: readonly string[];
    /** Allowed object and embed sources. */
    objectSrc?: readonly string[];
    /** Allowed nested browsing context sources. */
    frameSrc?: readonly string[];
    /** Allowed worker and nested browsing context sources. */
    childSrc?: readonly string[];
    /** Allowed worker sources. */
    workerSrc?: readonly string[];
    /** Allowed web app manifest sources. */
    manifestSrc?: readonly string[];
    /** Allowed base element URLs. */
    baseUri?: readonly string[];
    /** Allowed form submission destinations. */
    formAction?: readonly string[];
    /** Allowed embedding ancestors. */
    frameAncestors?: readonly string[];
    /** Sandbox allowances. An empty array enables all sandbox restrictions. */
    sandbox?: readonly string[];
    /** Upgrade insecure resource requests to HTTPS. */
    upgradeInsecureRequests?: boolean;
    /** A single reporting endpoint name, expressed as an HTTP token. */
    reportTo?: string;
    /** Legacy violation reporting URLs. */
    reportUri?: readonly string[];
    /** Trusted Types policy names and keywords. */
    trustedTypes?: readonly string[];
    /** Trusted Types sink groups, such as "'script'". */
    requireTrustedTypesFor?: readonly string[];
}
/**
 * A single Content Security Policy, independent of routing and nonce generation.
 * Comma-separated policy lists must be handled as separate policies.
 */
export declare class ContentSecurityPolicy implements HeaderValue {
    #private;
    constructor(init?: string | ContentSecurityPolicyInit | ContentSecurityPolicy);
    /**
     * Reads a directive by its case-insensitive, hyphenated name.
     * @param name Directive name, such as `script-src`.
     * @returns A copy of the tokens, or undefined when the directive is absent.
     */
    get(name: string): string[] | undefined;
    /**
     * Sets a directive, including extension directives. Tokens cannot contain whitespace or delimiters.
     * `report-to` requires exactly one HTTP token naming a reporting endpoint.
     * @param name Case-insensitive, hyphenated directive name.
     * @param values Individual CSP tokens; an empty array emits a valueless directive.
     */
    set(name: string, values: readonly string[]): void;
    /**
     * Removes a directive by its case-insensitive, hyphenated name.
     * @param name Directive to remove.
     */
    delete(name: string): void;
    /**
     * Serializes the policy without changing directive values or merging policies.
     * @returns A value suitable for a CSP or CSP report-only header.
     */
    toString(): string;
    /**
     * Parses or copies a single policy.
     * @param value Serialized policy, directive object, existing policy, or null.
     * @returns A new policy, empty when value is null.
     */
    static from(value: string | ContentSecurityPolicyInit | ContentSecurityPolicy | null): ContentSecurityPolicy;
}
//# sourceMappingURL=content-security-policy.d.ts.map