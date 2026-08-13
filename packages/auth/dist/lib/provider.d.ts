import type { RequestContext } from '@remix-run/fetch-router';
/**
 * DPoP binding material required to sign follow-up requests for DPoP-bound access tokens.
 */
export interface OAuthDpopBinding {
    /** Public JWK advertised in DPoP proofs. */
    publicJwk: JsonWebKey;
    /** Private JWK used to sign DPoP proofs. */
    privateJwk: JsonWebKey;
    /** Latest nonce advertised by the target server, when one is required. */
    nonce?: string;
}
/**
 * Shared token fields returned from a successful authorization code exchange.
 */
interface OAuthTokenBase {
    /** Access token returned by the provider. */
    accessToken: string;
    /** Refresh token returned by the provider, when available. */
    refreshToken?: string;
    /** Expiration time derived from the provider token response, when available. */
    expiresAt?: Date;
    /** Scopes granted to the current access token, when provided by the provider. */
    scope?: string[];
    /** OpenID Connect ID token returned by the provider, when available. */
    idToken?: string;
}
/**
 * OAuth tokens that are not bound to DPoP key material.
 */
export interface OAuthStandardTokens extends OAuthTokenBase {
    /** Token type returned by the provider, such as `Bearer`. */
    tokenType?: string;
    /** DPoP binding data is not present for non-DPoP tokens. */
    dpop?: undefined;
}
/**
 * OAuth tokens bound to a DPoP key pair.
 */
export interface OAuthDpopTokens extends OAuthTokenBase {
    /** DPoP-bound access tokens always advertise the `DPoP` token type. */
    tokenType: 'DPoP';
    /** DPoP binding material returned for DPoP-bound access tokens, when available. */
    dpop: OAuthDpopBinding;
}
/**
 * OAuth and OIDC tokens returned from a successful authorization code exchange.
 */
export type OAuthTokens = OAuthStandardTokens | OAuthDpopTokens;
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
export interface OAuthResult<profile, provider extends string = string, tokens extends OAuthTokens = OAuthTokens> {
    /** Provider name that completed the callback flow. */
    provider: provider;
    /** Stable provider-backed account identity for the authenticated user. */
    account: OAuthAccount<provider>;
    /** Normalized profile data returned by the provider. */
    profile: profile;
    /** Tokens returned by the provider for the completed authorization flow. */
    tokens: tokens;
}
/**
 * Public shape for an OAuth or OIDC provider used by external auth request handlers.
 */
export interface OAuthProvider<_profile, provider extends string = string, tokens extends OAuthTokens = OAuthTokens> {
    /** Provider name used for routing, callbacks, and persisted transactions. */
    name: provider;
    /**
     * Phantom token marker used to preserve provider-specific token types.
     *
     * @internal
     */
    readonly [oauthProviderTokens]?: (tokens: tokens) => tokens;
}
export interface OAuthTransaction {
    provider: string;
    state: string;
    codeVerifier: string;
    returnTo?: string;
    providerState?: string;
}
export interface OAuthProviderRuntime<profile, provider extends string = string, tokens extends OAuthTokens = OAuthTokens> {
    createAuthorizationURL(transaction: OAuthTransaction): URL | Promise<URL>;
    handleCallback(context: RequestContext, transaction: OAuthTransaction): Promise<OAuthResult<profile, provider, tokens>>;
    refreshTokens?(tokens: tokens): Promise<tokens>;
}
export declare const oauthProviderRuntime: unique symbol;
declare const oauthProviderTokens: unique symbol;
export type InternalOAuthProvider<profile, provider extends string = string, tokens extends OAuthTokens = OAuthTokens> = OAuthProvider<profile, provider, tokens> & {
    [oauthProviderRuntime]: OAuthProviderRuntime<profile, provider, tokens>;
};
interface ExchangeTokenOptionsBase {
    tokenEndpoint: string | URL;
    clientId: string;
    clientSecret: string;
    clientAuthentication?: 'request-body' | 'basic';
    headers?: HeadersInit;
}
export interface ExchangeAuthorizationCodeOptions extends ExchangeTokenOptionsBase {
    redirectUri: string | URL;
    code: string;
    codeVerifier: string;
}
export interface ExchangeRefreshTokenOptions extends ExchangeTokenOptionsBase {
    refreshToken: string;
    scopes?: string[];
}
export declare function createOAuthProvider<profile, provider extends string, tokens extends OAuthTokens = OAuthTokens>(name: provider, runtime: OAuthProviderRuntime<profile, provider, tokens>): OAuthProvider<profile, provider, tokens>;
export declare function getOAuthProviderRuntime<profile, provider extends string, tokens extends OAuthTokens = OAuthTokens>(provider: OAuthProvider<profile, provider, tokens>): OAuthProviderRuntime<profile, provider, tokens>;
export declare function createAuthorizationURL(endpoint: string | URL, params: Record<string, string | undefined>): URL;
export declare function exchangeAuthorizationCode(options: ExchangeAuthorizationCodeOptions): Promise<OAuthStandardTokens>;
export declare function exchangeRefreshToken(options: ExchangeRefreshTokenOptions): Promise<OAuthStandardTokens>;
export declare function mergeRefreshedStandardTokens(currentTokens: OAuthStandardTokens, refreshedTokens: OAuthStandardTokens): OAuthStandardTokens;
export declare function fetchJson<json>(input: RequestInfo | URL, init: RequestInit, fallbackError: string): Promise<json>;
export declare function getAuthorizationCode(context: RequestContext): string;
export {};
//# sourceMappingURL=provider.d.ts.map