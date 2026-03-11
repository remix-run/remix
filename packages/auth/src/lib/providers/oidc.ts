import type { RequestContext } from '@remix-run/fetch-router'

import type {
  OIDCMetadata,
  OIDCOptions as OIDCOptionsShape,
  OIDCProfile,
  OAuthProvider,
  OAuthResult,
  OAuthTokens,
} from '../types.ts'
import {
  createAuthorizationURL,
  createOAuthProvider,
  exchangeAuthorizationCode,
  fetchJson,
  getAuthorizationCode,
} from '../provider.ts'
import { createCodeChallenge } from '../utils.ts'

const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email']

export type OIDCOptions<
  profile extends OIDCProfile = OIDCProfile,
  provider extends string = 'oidc',
> = OIDCOptionsShape<profile, provider>

export function oidc<
  profile extends OIDCProfile = OIDCProfile,
  provider extends string = 'oidc',
>(options: OIDCOptions<profile, provider>): OAuthProvider<profile, provider> {
  let name = options.name ?? ('oidc' as provider)
  let scopes = options.scopes ?? DEFAULT_OIDC_SCOPES
  let metadataPromise: Promise<OIDCMetadata> | undefined

  function getMetadata(): Promise<OIDCMetadata> {
    if (options.metadata != null) {
      return Promise.resolve(validateOIDCMetadata(options.metadata, name))
    }

    if (metadataPromise == null) {
      metadataPromise = discoverOIDCMetadata(options, name).catch(error => {
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
    async authenticate(context, transaction): Promise<OAuthResult<profile, provider>> {
      let metadata = await getMetadata()
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: metadata.token_endpoint,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
      })
      let claims = await fetchOIDCProfile(name, metadata, tokens, context)
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
  options: OIDCOptions<any, any>,
  name: string,
): Promise<OIDCMetadata> {
  let metadata = await fetchJson<OIDCMetadata>(
    options.discoveryUrl ?? createDiscoveryURL(options.issuer),
    {},
    `Failed to load OIDC metadata for "${name}".`,
  )

  return validateOIDCMetadata(metadata, name)
}

async function fetchOIDCProfile(
  name: string,
  metadata: OIDCMetadata,
  tokens: OAuthTokens,
  _context: RequestContext,
): Promise<OIDCProfile> {
  if (metadata.userinfo_endpoint == null || metadata.userinfo_endpoint.length === 0) {
    throw new Error(`OIDC provider "${name}" did not publish a userinfo_endpoint.`)
  }

  let claims = await fetchJson<OIDCProfile>(
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
  profile extends OIDCProfile = OIDCProfile,
  provider extends string = 'oidc',
>(
  options: OIDCOptions<profile, provider>,
  claims: OIDCProfile,
  tokens: OAuthTokens,
  metadata: OIDCMetadata,
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

function validateOIDCMetadata(metadata: OIDCMetadata, name: string): OIDCMetadata {
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
