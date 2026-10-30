import type { Middleware, RequestContext } from '@remix-run/fetch-router';
import { ContentSecurityPolicy, type ContentSecurityPolicyInit } from '@remix-run/headers/content-security-policy';
import { CspNonce } from './nonce.ts';
/** A single static CSP, either serialized or expressed as directives. */
export type CspPolicy = string | ContentSecurityPolicyInit | ContentSecurityPolicy;
/** Values available while creating a request's policy, before downstream handlers run. */
export interface CspPolicyContext {
    /** Cryptographically random nonce, shared with internal renders of this document. */
    nonce: string;
    /** Current router request context. */
    context: RequestContext;
}
/** Creates a policy using the current request's nonce and context. */
export type CspPolicyFactory = (context: CspPolicyContext) => CspPolicy | Promise<CspPolicy>;
interface CspOptionFields {
    /** Enforced policy sent as `Content-Security-Policy`, static or a factory run before handlers. */
    policy?: CspPolicy | CspPolicyFactory;
    /**
     * Policy sent as `Content-Security-Policy-Report-Only`, static or a factory run before handlers.
     * Both policies share the request nonce.
     */
    reportOnlyPolicy?: CspPolicy | CspPolicyFactory;
    /**
     * Named absolute or relative URLs for `Reporting-Endpoints`, referenced by `reportTo`.
     * Configured names override matching downstream entries; other entries are preserved.
     * Names must be structured field keys; URLs must contain only printable ASCII characters.
     */
    reportingEndpoints?: Readonly<Record<string, string>>;
    /**
     * Select responses for policy and reporting headers (default `text/html` responses).
     * Runs after downstream handlers; returning false preserves the response.
     * Nonce and policy creation still run before handlers. 304 responses are always unchanged.
     */
    filter?: (response: Response) => boolean;
}
type CspPolicyOption = CspPolicy | CspPolicyFactory;
/** Policy and response configuration for CSP middleware. Provide `policy`, `reportOnlyPolicy`, or both. */
export type CspOptions = CspOptionFields & ({
    policy: CspPolicyOption;
} | {
    reportOnlyPolicy: CspPolicyOption;
});
type RequiredPolicy = {
    policy: NonNullable<unknown>;
} | {
    reportOnlyPolicy: NonNullable<unknown>;
};
type CheckedPolicy<policy> = policy extends undefined ? undefined : policy extends (...args: never[]) => infer result ? (context: CspPolicyContext) => CheckedPolicy<Awaited<result>> | Promise<CheckedPolicy<Awaited<result>>> : policy extends string | ContentSecurityPolicy ? policy : policy extends ContentSecurityPolicyInit ? policy & Record<Exclude<keyof policy, keyof ContentSecurityPolicyInit>, never> : never;
type CheckedOptions<policy extends CspPolicyOption | undefined, reportOnlyPolicy extends CspPolicyOption | undefined> = Omit<CspOptionFields, 'policy' | 'reportOnlyPolicy'> & {
    policy?: policy;
    reportOnlyPolicy?: reportOnlyPolicy;
} & ([policy] extends [CheckedPolicy<policy>] ? unknown : {
    policy: CheckedPolicy<policy>;
}) & ([reportOnlyPolicy] extends [CheckedPolicy<reportOnlyPolicy>] ? unknown : {
    reportOnlyPolicy: CheckedPolicy<reportOnlyPolicy>;
}) & RequiredPolicy;
/**
 * Establishes a request nonce and appends the configured CSPs to HTML responses by default.
 * `policy` is enforced and `reportOnlyPolicy` is monitored; either or both may be given.
 * Override `filter` for other response types; 304 responses are always unchanged.
 * Existing policies are preserved separately. Inferred policies reject unknown directive keys.
 * @param options The enforced and/or report-only policy and optional response configuration.
 * @returns Middleware providing the nonce read by `getCspNonce()` and the CSP response headers.
 */
export declare function csp<policy extends CspPolicyOption | undefined, reportOnlyPolicy extends CspPolicyOption | undefined>(options: CheckedOptions<policy, reportOnlyPolicy>): Middleware<{
    key: typeof CspNonce;
    value: string;
}>;
export {};
//# sourceMappingURL=csp.d.ts.map