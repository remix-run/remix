import type { RequestContext } from '@remix-run/fetch-router';
/**
 * OAuth and OIDC tokens returned from a successful authorization code exchange.
 */
export interface OAuthTokens {
    /** Access token returned by the provider. */
    accessToken: string;
    /** Refresh token returned by the provider, when available. */
    refreshToken?: string;
    /** Token type returned by the provider, such as `Bearer`. */
    tokenType?: string;
    /** Expiration time derived from the provider token response, when available. */
    expiresAt?: Date;
    /** Scopes granted to the current access token, when provided by the provider. */
    scope?: string[];
    /** OpenID Connect ID token returned by the provider, when available. */
    idToken?: string;
}
/**
 * Stable account identifier for a provider-backed identity.
 */
export interface OAuthAccount<provider extends string = string> {
    /** Provider name that issued the account identifier. */
    provider: provider;
    /** Stable provider-specific account identifier for the authenticated user. */
    providerAccountId: string;
}
/**
 * Normalized result returned by OAuth and OIDC callback handlers.
 */
export interface OAuthResult<profile, provider extends string = string> {
    /** Provider name that completed the callback flow. */
    provider: provider;
    /** Stable provider-backed account identity for the authenticated user. */
    account: OAuthAccount<provider>;
    /** Normalized profile data returned by the provider. */
    profile: profile;
    /** Tokens returned by the provider for the completed authorization flow. */
    tokens: OAuthTokens;
}
/**
 * Public shape for an OAuth or OIDC provider used by external auth request handlers.
 */
export interface OAuthProvider<profile, provider extends string = string> {
    /** Provider name used for routing, callbacks, and persisted transactions. */
    name: provider;
}
export interface OAuthTransaction {
    provider: string;
    state: string;
    codeVerifier: string;
    returnTo?: string;
}
export interface OAuthProviderRuntime<profile, provider extends string = string> {
    createAuthorizationURL(transaction: OAuthTransaction): URL | Promise<URL>;
    handleCallback(context: RequestContext, transaction: OAuthTransaction): Promise<OAuthResult<profile, provider>>;
}
export declare const oauthProviderRuntime: unique symbol;
export type InternalOAuthProvider<profile, provider extends string = string> = OAuthProvider<profile, provider> & {
    [oauthProviderRuntime]: OAuthProviderRuntime<profile, provider>;
};
export interface ExchangeAuthorizationCodeOptions {
    tokenEndpoint: string | URL;
    clientId: string;
    clientSecret: string;
    redirectUri: string | URL;
    code: string;
    codeVerifier: string;
    clientAuthentication?: 'request-body' | 'basic';
    headers?: HeadersInit;
}
export declare function createOAuthProvider<profile, provider extends string>(name: provider, runtime: OAuthProviderRuntime<profile, provider>): OAuthProvider<profile, provider>;
export declare function getOAuthProviderRuntime<profile, provider extends string>(provider: OAuthProvider<profile, provider>): OAuthProviderRuntime<profile, provider>;
export declare function createAuthorizationURL(endpoint: string | URL, params: Record<string, string | undefined>): URL;
export declare function exchangeAuthorizationCode(options: ExchangeAuthorizationCodeOptions): Promise<OAuthTokens>;
export declare function fetchJson<json>(input: RequestInfo | URL, init: RequestInit, fallbackError: string): Promise<json>;
export declare function getAuthorizationCode(context: RequestContext): string;
//# sourceMappingURL=provider.d.ts.map