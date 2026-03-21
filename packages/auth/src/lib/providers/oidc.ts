import type { RequestContext } from '@remix-run/fetch-router'

import type { OAuthProvider, OAuthResult, OAuthTokens } from '../provider.ts'
import {
  createAuthorizationURL,
  createOAuthProvider,
  exchangeAuthorizationCode,
  fetchJson,
  getAuthorizationCode,
} from '../provider.ts'
import { createCodeChallenge } from '../utils.ts'

const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email']

/**
 * OpenID Connect discovery metadata.
 */
export interface OIDCAuthProviderMetadata {
  /** Issuer identifier for the OIDC provider. */
  issuer: string
  /** Authorization endpoint used to start the browser login flow. */
  authorization_endpoint: string
  /** Token endpoint used to exchange the authorization code. */
  token_endpoint: string
  /** UserInfo endpoint used to load profile claims, when available. */
  userinfo_endpoint?: string
  /** JWKS endpoint published by the provider, when available. */
  jwks_uri?: string
  /** RP-initiated logout endpoint published by the provider, when available. */
  end_session_endpoint?: string
  /** Scopes advertised by the provider, when available. */
  scopes_supported?: string[]
  /** Claims advertised by the provider, when available. */
  claims_supported?: string[]
  /** PKCE challenge methods advertised by the provider, when available. */
  code_challenge_methods_supported?: string[]
}

/**
 * Base OpenID Connect claims shape used by the OIDC helpers.
 */
export interface OIDCAuthProfile {
  /** Stable subject identifier for the authenticated user. */
  sub: string
  /** Full display name for the authenticated user. */
  name?: string
  /** Given name claim for the authenticated user. */
  given_name?: string
  /** Family name claim for the authenticated user. */
  family_name?: string
  /** Middle name claim for the authenticated user. */
  middle_name?: string
  /** Nickname claim for the authenticated user. */
  nickname?: string
  /** Preferred username claim for the authenticated user. */
  preferred_username?: string
  /** Profile URL claim for the authenticated user. */
  profile?: string
  /** Profile picture URL claim for the authenticated user. */
  picture?: string
  /** Personal website URL claim for the authenticated user. */
  website?: string
  /** Email address claim for the authenticated user. */
  email?: string
  /** Indicates whether the provider has verified `email`. */
  email_verified?: boolean
  /** Gender claim for the authenticated user. */
  gender?: string
  /** Birthdate claim for the authenticated user. */
  birthdate?: string
  /** Time zone claim for the authenticated user. */
  zoneinfo?: string
  /** Locale claim for the authenticated user. */
  locale?: string
  /** Phone number claim for the authenticated user. */
  phone_number?: string
  /** Indicates whether the provider has verified `phone_number`. */
  phone_number_verified?: boolean
  /** Timestamp claim describing when the profile was last updated. */
  updated_at?: number | string
  /** Additional provider-specific claims returned by the UserInfo endpoint. */
  [key: string]: unknown
}

/**
 * Options for creating a generic OpenID Connect provider.
 */
export interface OIDCAuthProviderOptions<
  profile extends OIDCAuthProfile = OIDCAuthProfile,
  provider extends string = 'oidc',
> {
  /** Provider name exposed in callback results and persisted transactions. */
  name?: provider
  /** Issuer base URL used for discovery and validation. */
  issuer: string | URL
  /** OAuth client identifier for your application. */
  clientId: string
  /** OAuth client secret for your application. */
  clientSecret: string
  /** Callback URL registered with the provider. */
  redirectUri: string | URL
  /** Requested scopes for the login flow. */
  scopes?: string[]
  /** Optional override for the discovery document URL. */
  discoveryUrl?: string | URL
  /** Optional inline discovery metadata used instead of fetching it. */
  metadata?: OIDCAuthProviderMetadata
  /** Additional authorization parameters appended to the login redirect. */
  authorizationParams?: Record<string, string | undefined>
  /** Maps raw OIDC claims into an application-specific profile shape. */
  mapProfile?(input: {
    claims: OIDCAuthProfile
    tokens: OAuthTokens
    metadata: OIDCAuthProviderMetadata
    context: RequestContext
  }): profile | Promise<profile>
}

/**
 * Creates an OpenID Connect provider backed by discovery metadata or explicit endpoints.
 *
 * @param options OIDC settings, client credentials, and optional profile mapping hooks.
 * @returns An OAuth provider that can be passed to `startExternalAuth()` and `finishExternalAuth()`.
 */
export function createOIDCAuthProvider<
  profile extends OIDCAuthProfile = OIDCAuthProfile,
  provider extends string = 'oidc',
>(options: OIDCAuthProviderOptions<profile, provider>): OAuthProvider<profile, provider> {
  let name = options.name ?? ('oidc' as provider)
  let scopes = options.scopes ?? DEFAULT_OIDC_SCOPES
  let metadataPromise: Promise<OIDCAuthProviderMetadata> | undefined

  function getMetadata(): Promise<OIDCAuthProviderMetadata> {
    if (options.metadata != null) {
      return Promise.resolve(validateOIDCMetadata(options.metadata, name))
    }

    if (metadataPromise == null) {
      metadataPromise = discoverOIDCMetadata(options, name).catch((error) => {
        metadataPromise = undefined
        throw error
      })
    }

    return metadataPromise
  }

  return createOAuthProvider(name, {
    async createAuthorizationURL(transaction) {
      let metadata = await getMetadata()
      let challenge = await createCodeChallenge(transaction.codeVerifier)

      return createAuthorizationURL(metadata.authorization_endpoint, {
        ...options.authorizationParams,
        client_id: options.clientId,
        redirect_uri: toURLString(options.redirectUri),
        response_type: 'code',
        scope: scopes.join(' '),
        state: transaction.state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
    },
    async handleCallback(context, transaction): Promise<OAuthResult<profile, provider>> {
      let metadata = await getMetadata()
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: metadata.token_endpoint,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
      })
      let claims = await fetchOIDCProfile(name, metadata, tokens)
      let profile = await mapOIDCProfile(options, claims, tokens, metadata, context)

      return {
        provider: name,
        account: {
          provider: name,
          providerAccountId: claims.sub,
        },
        profile,
        tokens,
      }
    },
  })
}

async function discoverOIDCMetadata(
  options: OIDCAuthProviderOptions<any, any>,
  name: string,
): Promise<OIDCAuthProviderMetadata> {
  let metadata = await fetchJson<OIDCAuthProviderMetadata>(
    options.discoveryUrl ?? createDiscoveryURL(options.issuer),
    {},
    `Failed to load OIDC metadata for "${name}".`,
  )

  return validateOIDCMetadata(metadata, name)
}

async function fetchOIDCProfile(
  name: string,
  metadata: OIDCAuthProviderMetadata,
  tokens: OAuthTokens,
): Promise<OIDCAuthProfile> {
  if (metadata.userinfo_endpoint == null || metadata.userinfo_endpoint.length === 0) {
    throw new Error(`OIDC provider "${name}" did not publish a userinfo_endpoint.`)
  }

  let claims = await fetchJson<OIDCAuthProfile>(
    metadata.userinfo_endpoint,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    },
    `Failed to load OIDC profile for "${name}".`,
  )

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error(`OIDC provider "${name}" did not return a valid "sub" claim.`)
  }

  return claims
}

async function mapOIDCProfile<
  profile extends OIDCAuthProfile = OIDCAuthProfile,
  provider extends string = 'oidc',
>(
  options: OIDCAuthProviderOptions<profile, provider>,
  claims: OIDCAuthProfile,
  tokens: OAuthTokens,
  metadata: OIDCAuthProviderMetadata,
  context: RequestContext,
): Promise<profile> {
  if (options.mapProfile == null) {
    return claims as profile
  }

  return options.mapProfile({
    claims,
    tokens,
    metadata,
    context,
  })
}

function createDiscoveryURL(issuer: string | URL): URL {
  let base = toURLString(issuer)

  if (base.endsWith('/')) {
    return new URL(`${base}.well-known/openid-configuration`)
  }

  return new URL(`${base}/.well-known/openid-configuration`)
}

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}

function validateOIDCMetadata(
  metadata: OIDCAuthProviderMetadata,
  name: string,
): OIDCAuthProviderMetadata {
  if (typeof metadata.issuer !== 'string' || metadata.issuer.length === 0) {
    throw new Error(`OIDC metadata for "${name}" did not include an issuer.`)
  }

  if (
    typeof metadata.authorization_endpoint !== 'string' ||
    metadata.authorization_endpoint.length === 0
  ) {
    throw new Error(`OIDC metadata for "${name}" did not include an authorization_endpoint.`)
  }

  if (typeof metadata.token_endpoint !== 'string' || metadata.token_endpoint.length === 0) {
    throw new Error(`OIDC metadata for "${name}" did not include a token_endpoint.`)
  }

  return metadata
}
