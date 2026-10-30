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
     * Preserves the provider-specific token type for external auth helpers.
     *
     * @internal
     */
    readonly [oauthProviderTokens]?: (tokens: tokens) => tokens;
}
/**
 * In-progress OAuth data persisted between the authorization redirect and callback.
 */
export interface OAuthTransaction {
    /** Provider name that started the transaction. */
    readonly provider: string;
    /** Random value used to validate the callback. */
    readonly state: string;
    /** PKCE verifier used to exchange the callback authorization code. */
    readonly codeVerifier: string;
    /** Optional post-auth redirect target supplied by the application. */
    readonly returnTo?: string;
    /**
     * Opaque provider-owned data persisted with the transaction.
     *
     * Providers must encrypt sensitive values before assigning this field because session storage
     * is not guaranteed to provide confidentiality.
     */
    providerState?: string;
}
/**
 * Protocol hooks used by an OAuth provider package.
 */
export interface OAuthProviderRuntime<profile, provider extends string = string, tokens extends OAuthTokens = OAuthTokens> {
    /** Creates the provider authorization URL and may attach opaque provider state to the transaction. */
    createAuthorizationURL(transaction: OAuthTransaction): URL | Promise<URL>;
    /** Exchanges a valid callback for the normalized provider result. */
    handleCallback(context: RequestContext, transaction: OAuthTransaction): Promise<OAuthResult<profile, provider, tokens>>;
    /** Refreshes a provider-specific token bundle when the provider supports token refresh. */
    refreshTokens?(tokens: tokens): Promise<tokens>;
}
declare const oauthProviderTokens: unique symbol;
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
/**
 * Creates an OAuth provider for use with the external auth request helpers.
 *
 * @param name Stable provider name used for routing and persisted transactions.
 * @param runtime Provider-owned authorization, callback, and optional token refresh hooks.
 * @returns A provider that can be passed to `startExternalAuth()`, `finishExternalAuth()`, and
 * `refreshExternalAuth()`.
 */
export declare function createOAuthProvider<profile, provider extends string, tokens extends OAuthTokens = OAuthTokens>(name: provider, runtime: OAuthProviderRuntime<profile, provider, tokens>): OAuthProvider<profile, provider, tokens>;
export declare function getOAuthProviderRuntime<profile, provider extends string, tokens extends OAuthTokens = OAuthTokens>(provider: OAuthProvider<profile, provider, tokens>): OAuthProviderRuntime<profile, provider, tokens>;
export declare function createAuthorizationURL(endpoint: string | URL, params: Record<string, string | undefined>): URL;
export declare function exchangeAuthorizationCode(options: ExchangeAuthorizationCodeOptions): Promise<OAuthTokens>;
export declare function exchangeRefreshToken(options: ExchangeRefreshTokenOptions): Promise<OAuthTokens>;
export declare function mergeRefreshedTokens(currentTokens: OAuthTokens, refreshedTokens: OAuthTokens): OAuthTokens;
export declare function fetchJson<json>(input: RequestInfo | URL, init: RequestInit, fallbackError: string): Promise<json>;
export declare function getAuthorizationCode(context: RequestContext): string;
export {};
//# sourceMappingURL=provider.d.ts.map