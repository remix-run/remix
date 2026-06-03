import type { RequestContext } from '@remix-run/fetch-router';
import type { OAuthProvider, OAuthResult, OAuthTokens } from './provider.ts';
/**
 * Options for finishing an OAuth or OIDC callback flow.
 */
export interface FinishExternalAuthOptions {
    /** Session key used to read and clear the in-progress OAuth transaction. */
    transactionKey?: string;
}
/**
 * Completed result returned from a successful OAuth or OIDC callback flow.
 */
export interface FinishedExternalAuthResult<profile, provider extends string = string, tokens extends OAuthTokens = OAuthTokens> {
    /** Normalized OAuth or OIDC result returned by the provider runtime. */
    result: OAuthResult<profile, provider, tokens>;
    /** Preserved post-auth redirect target, when one was stored in the transaction. */
    returnTo?: string;
}
/**
 * Finishes an OAuth or OIDC callback flow for an external provider.
 *
 * @param provider The external provider that initiated the login flow.
 * @param context The current request context.
 * @param options Transaction lookup settings.
 * @returns The normalized provider result plus the preserved `returnTo` target, when available.
 */
export declare function finishExternalAuth<context extends RequestContext<any, any> = RequestContext, profile = never, provider extends string = string, tokens extends OAuthTokens = OAuthTokens>(provider: OAuthProvider<profile, provider, tokens>, context: context, options?: FinishExternalAuthOptions): Promise<FinishedExternalAuthResult<profile, provider, tokens>>;
//# sourceMappingURL=finish-external-auth.d.ts.map