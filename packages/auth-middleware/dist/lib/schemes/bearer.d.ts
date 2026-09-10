import type { RequestContext } from '@remix-run/fetch-router';
import type { AuthScheme } from '../auth.ts';
/**
 * Options for creating a bearer-token auth scheme.
 */
export interface BearerTokenAuthSchemeOptions<identity> {
    /** Method name exposed on the resolved auth state. */
    name?: string;
    /** Request header that carries the bearer token. */
    headerName?: string;
    /** Authorization scheme prefix expected in the header value. */
    scheme?: string;
    /** Verifies a parsed bearer token and returns the resolved identity on success. */
    verify(token: string, context: RequestContext): identity | null | Promise<identity | null>;
    /** Challenge value returned when the scheme rejects credentials. */
    challenge?: string;
}
/**
 * Creates an auth scheme that reads bearer tokens from a request header.
 *
 * @param options Header parsing and token verification options.
 * @returns An auth scheme for use with `auth()`.
 */
export declare function createBearerTokenAuthScheme<identity>(options: BearerTokenAuthSchemeOptions<identity>): AuthScheme<identity>;
//# sourceMappingURL=bearer.d.ts.map