import type { RequestContext } from '@remix-run/fetch-router';
import type { OAuthProvider, OAuthTokens } from '../provider.ts';
/**
 * OpenID Connect discovery metadata.
 */
export interface OIDCAuthProviderMetadata {
    /** Issuer identifier for the OIDC provider. */
    issuer: string;
    /** Authorization endpoint used to start the browser login flow. */
    authorization_endpoint: string;
    /** Token endpoint used to exchange the authorization code. */
    token_endpoint: string;
    /** UserInfo endpoint used to load profile claims, when available. */
    userinfo_endpoint?: string;
    /** JWKS endpoint published by the provider, when available. */
    jwks_uri?: string;
    /** RP-initiated logout endpoint published by the provider, when available. */
    end_session_endpoint?: string;
    /** Scopes advertised by the provider, when available. */
    scopes_supported?: string[];
    /** Claims advertised by the provider, when available. */
    claims_supported?: string[];
    /** PKCE challenge methods advertised by the provider, when available. */
    code_challenge_methods_supported?: string[];
}
/**
 * Base OpenID Connect claims shape used by the OIDC helpers.
 */
export interface OIDCAuthProfile {
    /** Stable subject identifier for the authenticated user. */
    sub: string;
    /** Full display name for the authenticated user. */
    name?: string;
    /** Given name claim for the authenticated user. */
    given_name?: string;
    /** Family name claim for the authenticated user. */
    family_name?: string;
    /** Middle name claim for the authenticated user. */
    middle_name?: string;
    /** Nickname claim for the authenticated user. */
    nickname?: string;
    /** Preferred username claim for the authenticated user. */
    preferred_username?: string;
    /** Profile URL claim for the authenticated user. */
    profile?: string;
    /** Profile picture URL claim for the authenticated user. */
    picture?: string;
    /** Personal website URL claim for the authenticated user. */
    website?: string;
    /** Email address claim for the authenticated user. */
    email?: string;
    /** Indicates whether the provider has verified `email`. */
    email_verified?: boolean;
    /** Gender claim for the authenticated user. */
    gender?: string;
    /** Birthdate claim for the authenticated user. */
    birthdate?: string;
    /** Time zone claim for the authenticated user. */
    zoneinfo?: string;
    /** Locale claim for the authenticated user. */
    locale?: string;
    /** Phone number claim for the authenticated user. */
    phone_number?: string;
    /** Indicates whether the provider has verified `phone_number`. */
    phone_number_verified?: boolean;
    /** Timestamp claim describing when the profile was last updated. */
    updated_at?: number | string;
    /** Additional provider-specific claims returned by the UserInfo endpoint. */
    [key: string]: unknown;
}
/**
 * Options for creating a generic OpenID Connect provider.
 */
export interface OIDCAuthProviderOptions<profile extends OIDCAuthProfile = OIDCAuthProfile, provider extends string = 'oidc'> {
    /** Provider name exposed in callback results and persisted transactions. */
    name?: provider;
    /** Issuer base URL used for discovery and validation. */
    issuer: string | URL;
    /** OAuth client identifier for your application. */
    clientId: string;
    /** OAuth client secret for your application. */
    clientSecret: string;
    /** Callback URL registered with the provider. */
    redirectUri: string | URL;
    /** Requested scopes for the login flow. */
    scopes?: string[];
    /** Optional override for the discovery document URL. */
    discoveryUrl?: string | URL;
    /** Optional inline discovery metadata used instead of fetching it. */
    metadata?: OIDCAuthProviderMetadata;
    /** Additional authorization parameters appended to the login redirect. */
    authorizationParams?: Record<string, string | undefined>;
    /** Maps raw OIDC claims into an application-specific profile shape. */
    mapProfile?(input: {
        claims: OIDCAuthProfile;
        tokens: OAuthTokens;
        metadata: OIDCAuthProviderMetadata;
        context: RequestContext;
    }): profile | Promise<profile>;
}
/**
 * Creates an OpenID Connect provider backed by discovery metadata or explicit endpoints.
 *
 * @param options OIDC settings, client credentials, and optional profile mapping hooks.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createOIDCAuthProvider<profile extends OIDCAuthProfile = OIDCAuthProfile, provider extends string = 'oidc'>(options: OIDCAuthProviderOptions<profile, provider>): OAuthProvider<profile, provider>;
//# sourceMappingURL=oidc.d.ts.map