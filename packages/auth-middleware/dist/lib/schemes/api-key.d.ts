import type { RequestContext } from '@remix-run/fetch-router';
import type { AuthScheme } from '../auth.ts';
/**
 * Options for creating an API-key auth scheme.
 */
export interface APIAuthSchemeOptions<identity> {
    /** Method name exposed on the resolved auth state. */
    name?: string;
    /** Request header that carries the API key. */
    headerName?: string;
    /** Verifies a parsed API key and returns the resolved identity on success. */
    verify(key: string, context: RequestContext): identity | null | Promise<identity | null>;
}
/**
 * Creates an auth scheme that reads API keys from a request header.
 *
 * @param options Header parsing and key verification options.
 * @returns An auth scheme for use with `auth()`.
 */
export declare function createAPIAuthScheme<identity>(options: APIAuthSchemeOptions<identity>): AuthScheme<identity>;
//# sourceMappingURL=api-key.d.ts.map