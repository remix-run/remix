import type { RequestContext } from '@remix-run/fetch-router';
import type { OAuthProvider, OAuthTokens } from './provider.ts';
/**
 * Options for starting an OAuth or OIDC login redirect flow.
 */
export interface StartExternalAuthOptions {
    /** Session key used to store the in-progress OAuth transaction. */
    transactionKey?: string;
    /** Optional post-auth redirect target to preserve in the OAuth transaction. */
    returnTo?: string | null;
}
/**
 * Starts an OAuth or OIDC login redirect flow for an external provider.
 *
 * @param provider The external provider to redirect to.
 * @param context The current request context.
 * @param options Transaction storage and optional return-to settings.
 * @returns A redirect response to the provider authorization URL.
 */
export declare function startExternalAuth<context extends RequestContext<any, any> = RequestContext, profile = never, provider extends string = string, tokens extends OAuthTokens = OAuthTokens>(provider: OAuthProvider<profile, provider, tokens>, context: context, options?: StartExternalAuthOptions): Promise<Response>;
//# sourceMappingURL=start-external-auth.d.ts.map