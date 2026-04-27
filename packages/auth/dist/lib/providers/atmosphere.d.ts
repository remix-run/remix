import type { RequestContext } from '@remix-run/fetch-router';
import type { OAuthDpopTokens, OAuthProvider } from '../provider.ts';
/**
 * Profile returned by the built-in Atmosphere auth provider.
 */
export interface AtmosphereAuthProfile {
    /** Stable DID for the authenticated atproto account. */
    did: string;
    /** Verified handle claimed by the DID document, when one is available. */
    handle?: string;
    /** Personal Data Server URL declared in the DID document. */
    pdsUrl: string;
    /** Authorization server issuer that authorized the current session. */
    authorizationServer: string;
}
/**
 * Authorization server metadata used by the Atmosphere provider.
 */
export interface AtmosphereAuthorizationServerMetadata {
    /** Issuer origin for the authorization server. */
    issuer: string;
    /** Browser authorization endpoint used after PAR completes. */
    authorization_endpoint: string;
    /** Token endpoint used for authorization-code exchanges. */
    token_endpoint: string;
    /** Pushed authorization request endpoint required by atproto OAuth. */
    pushed_authorization_request_endpoint: string;
    /** Scopes advertised by the authorization server. */
    scopes_supported?: string[] | string;
    /** Token endpoint auth methods accepted by the authorization server. */
    token_endpoint_auth_methods_supported?: string[];
    /** Signing algorithms accepted for private-key JWT client authentication. */
    token_endpoint_auth_signing_alg_values_supported?: string[];
    /** PKCE challenge methods accepted by the authorization server. */
    code_challenge_methods_supported?: string[];
    /** OAuth response types accepted by the authorization server. */
    response_types_supported?: string[];
    /** OAuth grant types accepted by the authorization server. */
    grant_types_supported?: string[];
    /** Indicates whether the `iss` query parameter is returned in callbacks. */
    authorization_response_iss_parameter_supported?: boolean;
    /** Indicates whether the authorization server requires PAR. */
    require_pushed_authorization_requests?: boolean;
    /** Indicates whether the server supports client metadata document lookup. */
    client_id_metadata_document_supported?: boolean;
    /** DPoP signing algorithms accepted by the authorization server. */
    dpop_signing_alg_values_supported?: string[];
}
/**
 * Client-authentication settings for confidential Atmosphere clients.
 */
export interface AtmosphereClientAuthentication {
    /** Private `ES256` signing key used to generate `private_key_jwt` assertions. */
    key: CryptoKey;
    /** Key identifier published in the client's JWKS metadata. */
    keyId: string;
}
/**
 * Input passed to `mapProfile()` for the Atmosphere provider.
 */
export interface AtmosphereAuthProviderMapProfileInput {
    /** Original handle or DID used to start the authorization flow. */
    identifier: string;
    /** Stable DID returned by the authorization server token response. */
    did: string;
    /** Verified handle claimed by the DID document, when one is available. */
    handle?: string;
    /** Personal Data Server URL declared in the DID document. */
    pdsUrl: string;
    /** Authorization server metadata resolved for the authenticated account. */
    authorizationServer: AtmosphereAuthorizationServerMetadata;
    /** OAuth tokens returned by the atproto authorization server. */
    tokens: OAuthDpopTokens;
    /** Request context for the callback currently being processed. */
    context: RequestContext;
}
/**
 * Options for creating an Atmosphere auth provider.
 */
export interface AtmosphereAuthProviderOptions<profile extends AtmosphereAuthProfile = AtmosphereAuthProfile> {
    /** Public client metadata URL, or `http://localhost` for loopback development clients. */
    clientId: string | URL;
    /** Redirect URI registered for the client metadata document. */
    redirectUri: string | URL;
    /** Secret used to encrypt per-flow DPoP state stored in the OAuth transaction session value. */
    sessionSecret: string;
    /** Requested atproto OAuth scopes. Must include `atproto`. */
    scopes?: string[];
    /** Additional authorization parameters included in the pushed authorization request. */
    authorizationParams?: Record<string, string | undefined>;
    /** Optional confidential-client settings for `private_key_jwt` authentication. */
    clientAuthentication?: AtmosphereClientAuthentication;
    /** Maps the resolved atproto identity into an application-specific profile shape. */
    mapProfile?(input: AtmosphereAuthProviderMapProfileInput): profile | Promise<profile>;
}
/**
 * Creates an Atmosphere auth provider factory with shared client options.
 *
 * Because atproto discovery is account-specific, apps should create the factory
 * once with shared options, then call it with the request-time handle or DID.
 *
 * @param options Atmosphere client configuration, session encryption secret, and optional profile mapping hooks.
 * @returns A function that resolves a handle or DID into a provider for `startExternalAuth()` and `finishExternalAuth()`.
 */
export declare function createAtmosphereAuthProvider<profile extends AtmosphereAuthProfile = AtmosphereAuthProfile>(options: AtmosphereAuthProviderOptions<profile>): (handleOrDid: string) => Promise<OAuthProvider<profile, 'atmosphere', OAuthDpopTokens>>;
//# sourceMappingURL=atmosphere.d.ts.map