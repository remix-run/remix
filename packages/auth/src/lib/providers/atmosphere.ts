import type { RequestContext } from '@remix-run/fetch-router'

import type { OAuthDpopTokens, OAuthProvider, OAuthResult, OAuthTransaction } from '../provider.ts'
import { createAuthorizationURL, createOAuthProvider, getAuthorizationCode } from '../provider.ts'
import { createCodeChallenge, getRequiredSearchParam } from '../utils.ts'

const ATMOSPHERE_PROVIDER_NAME = 'atmosphere'
const CLOUDFLARE_DNS_ENDPOINT = 'https://1.1.1.1/dns-query'
const PLC_DIRECTORY_URL = 'https://plc.directory/'
const DEFAULT_ATMOSPHERE_SCOPES = ['atproto']
const ATPROTO_PDS_SERVICE_ID = '#atproto_pds'
const ATPROTO_PDS_SERVICE_TYPE = 'AtprotoPersonalDataServer'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]'])
const DISALLOWED_HANDLE_TLDS = new Set([
  'alt',
  'arpa',
  'example',
  'internal',
  'invalid',
  'local',
  'localhost',
  'onion',
])
const DID_REGEX = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/
const HANDLE_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Profile returned by the built-in Atmosphere auth provider.
 */
export interface AtmosphereAuthProfile {
  /** Stable DID for the authenticated atproto account. */
  did: string
  /** Verified handle claimed by the DID document, when one is available. */
  handle?: string
  /** Personal Data Server URL declared in the DID document. */
  pdsUrl: string
  /** Authorization server issuer that authorized the current session. */
  authorizationServer: string
}

/**
 * Authorization server metadata used by the Atmosphere provider.
 */
export interface AtmosphereAuthorizationServerMetadata {
  /** Issuer origin for the authorization server. */
  issuer: string
  /** Browser authorization endpoint used after PAR completes. */
  authorization_endpoint: string
  /** Token endpoint used for authorization-code exchanges. */
  token_endpoint: string
  /** Pushed authorization request endpoint required by atproto OAuth. */
  pushed_authorization_request_endpoint: string
  /** Scopes advertised by the authorization server. */
  scopes_supported?: string[] | string
  /** Token endpoint auth methods accepted by the authorization server. */
  token_endpoint_auth_methods_supported?: string[]
  /** Signing algorithms accepted for private-key JWT client authentication. */
  token_endpoint_auth_signing_alg_values_supported?: string[]
  /** PKCE challenge methods accepted by the authorization server. */
  code_challenge_methods_supported?: string[]
  /** OAuth response types accepted by the authorization server. */
  response_types_supported?: string[]
  /** OAuth grant types accepted by the authorization server. */
  grant_types_supported?: string[]
  /** Indicates whether the `iss` query parameter is returned in callbacks. */
  authorization_response_iss_parameter_supported?: boolean
  /** Indicates whether the authorization server requires PAR. */
  require_pushed_authorization_requests?: boolean
  /** Indicates whether the server supports client metadata document lookup. */
  client_id_metadata_document_supported?: boolean
  /** DPoP signing algorithms accepted by the authorization server. */
  dpop_signing_alg_values_supported?: string[]
}

/**
 * Client-authentication settings for confidential Atmosphere clients.
 */
export interface AtmosphereClientAuthentication {
  /** Private `ES256` signing key used to generate `private_key_jwt` assertions. */
  key: CryptoKey
  /** Key identifier published in the client's JWKS metadata. */
  keyId: string
}

/**
 * Input passed to `mapProfile()` for the Atmosphere provider.
 */
export interface AtmosphereAuthProviderMapProfileInput {
  /** Original handle or DID used to start the authorization flow. */
  identifier: string
  /** Stable DID returned by the authorization server token response. */
  did: string
  /** Verified handle claimed by the DID document, when one is available. */
  handle?: string
  /** Personal Data Server URL declared in the DID document. */
  pdsUrl: string
  /** Authorization server details retained for the authenticated account. */
  authorizationServer: AtmosphereTokenAuthorizationServer
  /** OAuth tokens returned by the atproto authorization server. */
  tokens: AtmosphereOAuthTokens
  /** Request context for the callback currently being processed. */
  context: RequestContext
}

/**
 * Authorization server details stored with Atmosphere DPoP-bound tokens for refresh.
 */
export interface AtmosphereTokenAuthorizationServer {
  /** Issuer origin for the authorization server that issued the token bundle. */
  issuer: string
  /** Token endpoint used for refresh-token exchanges. */
  tokenEndpoint: string
}

/**
 * DPoP-bound token bundle returned by the built-in Atmosphere auth provider.
 */
export interface AtmosphereOAuthTokens extends OAuthDpopTokens {
  /** DID that the authorization server bound to this token bundle. */
  did: string
  /** Authorization server metadata needed to refresh without account discovery. */
  authorizationServer: AtmosphereTokenAuthorizationServer
}

/**
 * Built-in Atmosphere auth provider.
 */
export interface AtmosphereAuthProvider<
  profile extends AtmosphereAuthProfile = AtmosphereAuthProfile,
> extends OAuthProvider<profile, 'atmosphere', AtmosphereOAuthTokens> {
  /**
   * Resolves a request-time handle or DID into a prepared provider for `startExternalAuth()`.
   */
  prepare(handleOrDid: string): Promise<OAuthProvider<profile, 'atmosphere', AtmosphereOAuthTokens>>
}

/**
 * Options for creating an Atmosphere auth provider.
 */
export interface AtmosphereAuthProviderOptions<
  profile extends AtmosphereAuthProfile = AtmosphereAuthProfile,
> {
  /** Public client metadata URL, or `http://localhost` for loopback development clients. */
  clientId: string | URL
  /** Redirect URI registered for the client metadata document. */
  redirectUri: string | URL
  /** Secret used to encrypt per-flow DPoP state stored in the OAuth transaction session value. */
  sessionSecret: string
  /** Requested atproto OAuth scopes. Must include `atproto`. */
  scopes?: string[]
  /** Additional authorization parameters included in the pushed authorization request. */
  authorizationParams?: Record<string, string | undefined>
  /** Optional confidential-client settings for `private_key_jwt` authentication. */
  clientAuthentication?: AtmosphereClientAuthentication
  /** Maps the resolved atproto identity into an application-specific profile shape. */
  mapProfile?(input: AtmosphereAuthProviderMapProfileInput): profile | Promise<profile>
}

interface AtmosphereIdentifier {
  input: string
  normalized: string
  type: 'did' | 'handle'
}

interface AtmosphereClientConfiguration {
  clientId: string
  redirectUri: string
  loopback: boolean
}

interface AtmosphereResolvedIdentity {
  did: string
  handle?: string
  pdsUrl: string
}

interface AtmosphereProtectedResourceMetadata {
  authorization_servers?: unknown
}

interface AtmosphereDidDocument {
  id?: unknown
  alsoKnownAs?: unknown
  service?: unknown
}

interface AtmosphereSessionState {
  identifier: string
  did: string
  handle?: string
  pdsUrl: string
  authorizationServer: AtmosphereTokenAuthorizationServer
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
  authorizationServerNonce?: string
}

interface AtmosphereParResponse {
  request_uri: string
}

interface AtmosphereTokenResponse {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
  sub: string
}

/**
 * Creates an Atmosphere auth provider with shared client options.
 *
 * Because atproto discovery is account-specific, call `prepare(handleOrDid)`
 * before passing this provider to `startExternalAuth()`.
 *
 * @param options Atmosphere client configuration, session encryption secret, and optional profile mapping hooks.
 * @returns A provider that can be prepared for `startExternalAuth()` and passed directly to `finishExternalAuth()` and `refreshExternalAuth()`.
 */
export function createAtmosphereAuthProvider<
  profile extends AtmosphereAuthProfile = AtmosphereAuthProfile,
>(options: AtmosphereAuthProviderOptions<profile>): AtmosphereAuthProvider<profile> {
  let scopes = normalizeAtmosphereScopes(options.scopes)
  let sessionSecret = normalizeAtmosphereSessionSecret(options.sessionSecret)
  let client = normalizeAtmosphereClientConfiguration(options.clientId, options.redirectUri, scopes)

  async function handleCallback(
    context: RequestContext,
    transaction: OAuthTransaction,
  ): Promise<OAuthResult<profile, 'atmosphere', AtmosphereOAuthTokens>> {
    let callbackIssuer = getRequiredSearchParam(context, 'iss')
    let sessionState = await readAtmosphereSessionState(sessionSecret, transaction)
    let authorizationServer = sessionState.authorizationServer

    if (
      callbackIssuer !== authorizationServer.issuer ||
      sessionState.authorizationServer.issuer !== callbackIssuer
    ) {
      throw new Error('Atmosphere callback issuer did not match the resolved authorization server.')
    }

    let tokenResponse = await sendDpopFormRequest<AtmosphereTokenResponse>({
      endpoint: authorizationServer.tokenEndpoint,
      body: await createAtmosphereTokenRequestBody({
        clientId: client.clientId,
        redirectUri: client.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
        clientAuthentication: options.clientAuthentication,
        issuer: authorizationServer.issuer,
      }),
      dpopKeyPair: {
        publicJwk: sessionState.publicJwk,
        privateJwk: sessionState.privateJwk,
      },
      fallbackError: 'Atmosphere token exchange failed.',
      nonce: sessionState.authorizationServerNonce,
    })
    let tokens = {
      ...normalizeAtmosphereTokenResponse(tokenResponse.json),
      did: sessionState.did,
      authorizationServer: {
        issuer: authorizationServer.issuer,
        tokenEndpoint: authorizationServer.tokenEndpoint,
      },
      dpop: {
        publicJwk: sessionState.publicJwk,
        privateJwk: sessionState.privateJwk,
        nonce: tokenResponse.nonce,
      },
    } satisfies AtmosphereOAuthTokens

    if (tokenResponse.json.sub !== sessionState.did) {
      throw new Error('Atmosphere token response did not match the resolved account DID.')
    }

    let profile = await mapAtmosphereProfile(options, {
      identifier: sessionState.identifier,
      did: sessionState.did,
      handle: sessionState.handle,
      pdsUrl: sessionState.pdsUrl,
      authorizationServer,
      tokens,
      context,
    })

    return {
      provider: ATMOSPHERE_PROVIDER_NAME,
      account: {
        provider: ATMOSPHERE_PROVIDER_NAME,
        providerAccountId: sessionState.did,
      },
      profile,
      tokens,
    }
  }

  async function refreshTokens(
    currentTokens: AtmosphereOAuthTokens,
  ): Promise<AtmosphereOAuthTokens> {
    if (currentTokens.refreshToken == null || currentTokens.refreshToken.length === 0) {
      throw new Error('Atmosphere provider did not receive a refresh token.')
    }

    let authorizationServer = validateAtmosphereTokenAuthorizationServer(
      currentTokens.authorizationServer,
    )
    let tokenResponse = await sendDpopFormRequest<AtmosphereTokenResponse>({
      endpoint: authorizationServer.tokenEndpoint,
      body: await createAtmosphereRefreshTokenRequestBody({
        clientId: client.clientId,
        refreshToken: currentTokens.refreshToken,
        clientAuthentication: options.clientAuthentication,
        issuer: authorizationServer.issuer,
      }),
      dpopKeyPair: {
        publicJwk: currentTokens.dpop.publicJwk,
        privateJwk: currentTokens.dpop.privateJwk,
      },
      fallbackError: 'Atmosphere refresh token exchange failed.',
      nonce: currentTokens.dpop.nonce,
    })
    let refreshedTokens = normalizeAtmosphereTokenResponse(tokenResponse.json)

    if (tokenResponse.json.sub !== currentTokens.did) {
      throw new Error('Atmosphere token response did not match the resolved account DID.')
    }

    return {
      ...currentTokens,
      ...refreshedTokens,
      refreshToken: refreshedTokens.refreshToken ?? currentTokens.refreshToken,
      expiresAt: refreshedTokens.expiresAt ?? currentTokens.expiresAt,
      scope: refreshedTokens.scope ?? currentTokens.scope,
      dpop: {
        publicJwk: currentTokens.dpop.publicJwk,
        privateJwk: currentTokens.dpop.privateJwk,
        nonce: tokenResponse.nonce ?? currentTokens.dpop.nonce,
      },
    }
  }

  let provider = createOAuthProvider<profile, 'atmosphere', AtmosphereOAuthTokens>(
    ATMOSPHERE_PROVIDER_NAME,
    {
      createAuthorizationURL() {
        throw new Error(
          'Atmosphere auth must be prepared with provider.prepare(handleOrDid) before starting the flow.',
        )
      },
      handleCallback,
      refreshTokens,
    },
  )

  return Object.assign(provider, {
    async prepare(
      handleOrDid: string,
    ): Promise<OAuthProvider<profile, 'atmosphere', AtmosphereOAuthTokens>> {
      let identifier = normalizeAtmosphereIdentifier(handleOrDid)
      let identity = await resolveAtmosphereIdentity(identifier)
      let authorizationServer = await discoverAuthorizationServer(
        identity.pdsUrl,
        options.clientAuthentication != null,
      )

      return createOAuthProvider<profile, 'atmosphere', AtmosphereOAuthTokens>(
        ATMOSPHERE_PROVIDER_NAME,
        {
          async createAuthorizationURL(transaction) {
            let challenge = await createCodeChallenge(transaction.codeVerifier)
            let dpopKeyPair = await generateDpopKeyPair()
            let stateFile: AtmosphereSessionState = {
              identifier: identifier.input,
              did: identity.did,
              handle: identity.handle,
              pdsUrl: identity.pdsUrl,
              authorizationServer: {
                issuer: authorizationServer.issuer,
                tokenEndpoint: authorizationServer.token_endpoint,
              },
              publicJwk: dpopKeyPair.publicJwk,
              privateJwk: dpopKeyPair.privateJwk,
            }
            let params = new URLSearchParams()

            for (let [key, value] of Object.entries(options.authorizationParams ?? {})) {
              if (value != null) {
                params.set(key, value)
              }
            }

            params.set('client_id', client.clientId)
            params.set('redirect_uri', client.redirectUri)
            params.set('response_type', 'code')
            params.set('scope', scopes.join(' '))
            params.set('state', transaction.state)
            params.set('code_challenge', challenge)
            params.set('code_challenge_method', 'S256')
            params.set('login_hint', identifier.input)

            if (options.clientAuthentication != null) {
              params.set(
                'client_assertion_type',
                'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
              )
              params.set(
                'client_assertion',
                await createClientAssertion(
                  client.clientId,
                  authorizationServer.issuer,
                  options.clientAuthentication,
                ),
              )
            }

            let parResponse = await sendDpopFormRequest<AtmosphereParResponse>({
              endpoint: authorizationServer.pushed_authorization_request_endpoint,
              body: params,
              dpopKeyPair,
              fallbackError: 'Atmosphere pushed authorization request failed.',
            })

            if (
              typeof parResponse.json.request_uri !== 'string' ||
              parResponse.json.request_uri.length === 0
            ) {
              throw new Error('Atmosphere PAR response did not include a request_uri.')
            }

            stateFile.authorizationServerNonce = parResponse.nonce
            transaction.providerState = await writeAtmosphereSessionState(
              sessionSecret,
              transaction.state,
              stateFile,
            )

            return createAuthorizationURL(authorizationServer.authorization_endpoint, {
              client_id: client.clientId,
              request_uri: parResponse.json.request_uri,
            })
          },
          handleCallback,
          refreshTokens,
        },
      )
    },
  })
}

async function mapAtmosphereProfile<profile extends AtmosphereAuthProfile>(
  options: AtmosphereAuthProviderOptions<profile>,
  input: AtmosphereAuthProviderMapProfileInput,
): Promise<profile> {
  if (options.mapProfile == null) {
    return {
      did: input.did,
      handle: input.handle,
      pdsUrl: input.pdsUrl,
      authorizationServer: input.authorizationServer.issuer,
    } as profile
  }

  return options.mapProfile(input)
}

async function createAtmosphereTokenRequestBody(options: {
  clientId: string
  redirectUri: string
  code: string
  codeVerifier: string
  issuer: string
  clientAuthentication?: AtmosphereClientAuthentication
}): Promise<URLSearchParams> {
  let body = new URLSearchParams({
    client_id: options.clientId,
    code: options.code,
    code_verifier: options.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: options.redirectUri,
  })

  if (options.clientAuthentication != null) {
    body.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
    body.set(
      'client_assertion',
      await createClientAssertion(options.clientId, options.issuer, options.clientAuthentication),
    )
  }

  return body
}

async function createAtmosphereRefreshTokenRequestBody(options: {
  clientId: string
  refreshToken: string
  issuer: string
  clientAuthentication?: AtmosphereClientAuthentication
}): Promise<URLSearchParams> {
  let body = new URLSearchParams({
    client_id: options.clientId,
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
  })

  if (options.clientAuthentication != null) {
    body.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
    body.set(
      'client_assertion',
      await createClientAssertion(options.clientId, options.issuer, options.clientAuthentication),
    )
  }

  return body
}

async function sendDpopFormRequest<json>(options: {
  endpoint: string
  body: URLSearchParams
  dpopKeyPair: { publicJwk: JsonWebKey; privateJwk: JsonWebKey }
  fallbackError: string
  nonce?: string
}): Promise<{ json: json; nonce?: string }> {
  let nonce = options.nonce
  let privateKey = await importPrivateEcKey(options.dpopKeyPair.privateJwk)

  for (let attempt = 0; attempt < 2; attempt++) {
    let response = await fetch(options.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        DPoP: await createDpopProof({
          method: 'POST',
          url: options.endpoint,
          nonce,
          privateKey,
          publicJwk: options.dpopKeyPair.publicJwk,
        }),
      },
      body: options.body,
    })
    let json = (await readJsonResponse(response)) as json
    let responseNonce = response.headers.get('DPoP-Nonce') ?? undefined

    if (response.ok) {
      return {
        json,
        nonce: responseNonce,
      }
    }

    if (isUseDpopNonceError(json) && responseNonce != null && attempt === 0) {
      nonce = responseNonce
      continue
    }

    throw new Error(getOAuthErrorMessage(json, options.fallbackError))
  }

  throw new Error(options.fallbackError)
}

async function createClientAssertion(
  clientId: string,
  issuer: string,
  authentication: AtmosphereClientAuthentication,
): Promise<string> {
  return createSignedJwt(
    {
      alg: 'ES256',
      kid: authentication.keyId,
    },
    {
      aud: issuer,
      exp: getUnixTimestamp() + 60,
      iat: getUnixTimestamp(),
      iss: clientId,
      jti: createJwtId(),
      sub: clientId,
    },
    authentication.key,
  )
}

async function createDpopProof(options: {
  method: string
  url: string
  nonce?: string
  privateKey: CryptoKey
  publicJwk: JsonWebKey
}): Promise<string> {
  return createSignedJwt(
    {
      alg: 'ES256',
      jwk: toPublicEcJwk(options.publicJwk),
      typ: 'dpop+jwt',
    },
    {
      exp: getUnixTimestamp() + 60,
      htm: options.method.toUpperCase(),
      htu: options.url,
      iat: getUnixTimestamp(),
      jti: createJwtId(),
      nonce: options.nonce,
    },
    options.privateKey,
  )
}

async function createSignedJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: CryptoKey,
): Promise<string> {
  let encodedHeader = base64UrlEncodeJson(header)
  let encodedPayload = base64UrlEncodeJson(
    Object.fromEntries(Object.entries(payload).filter(([, value]) => value != null)),
  )
  let signingInput = `${encodedHeader}.${encodedPayload}`
  let signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    textEncoder.encode(signingInput),
  )

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`
}

function getUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

function createJwtId(): string {
  let bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

async function generateDpopKeyPair(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
  let keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  let publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey
  let privateJwk = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey

  return {
    publicJwk: toPublicEcJwk(publicJwk),
    privateJwk,
  }
}

async function importPrivateEcKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
}

function toPublicEcJwk(jwk: JsonWebKey): JsonWebKey {
  return {
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  }
}

function normalizeAtmosphereTokenResponse(
  json: AtmosphereTokenResponse,
): Omit<AtmosphereOAuthTokens, 'authorizationServer' | 'did' | 'dpop'> {
  if (typeof json.access_token !== 'string' || json.access_token.length === 0) {
    throw new Error('Atmosphere token response did not include an access token.')
  }

  if (typeof json.sub !== 'string' || json.sub.length === 0) {
    throw new Error('Atmosphere token response did not include an account DID in "sub".')
  }

  let scope = parseScope(json.scope)
  if (scope == null || !scope.includes('atproto')) {
    throw new Error('Atmosphere token response did not include the required "atproto" scope.')
  }

  if (json.token_type !== 'DPoP') {
    throw new Error('Atmosphere token response did not include the required "DPoP" token type.')
  }

  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    tokenType: 'DPoP',
    expiresAt:
      typeof json.expires_in === 'number'
        ? new Date(Date.now() + json.expires_in * 1000)
        : undefined,
    scope,
  }
}

function validateAtmosphereTokenAuthorizationServer(
  value: unknown,
): AtmosphereTokenAuthorizationServer {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    throw new Error('Atmosphere tokens are missing authorization server metadata.')
  }

  let authorizationServer = value as Record<string, unknown>
  if (
    typeof authorizationServer.issuer !== 'string' ||
    authorizationServer.issuer.length === 0 ||
    typeof authorizationServer.tokenEndpoint !== 'string' ||
    authorizationServer.tokenEndpoint.length === 0
  ) {
    throw new Error('Atmosphere tokens are missing authorization server metadata.')
  }

  let issuer = validateAuthorizationServerOrigin(authorizationServer.issuer)

  return {
    issuer,
    tokenEndpoint: ensureUrl(
      authorizationServer.tokenEndpoint,
      issuer,
      'Atmosphere token endpoint',
    ),
  }
}

async function discoverAuthorizationServer(
  pdsUrl: string,
  confidential: boolean,
): Promise<AtmosphereAuthorizationServerMetadata> {
  let resourceMetadata = await fetchJson<AtmosphereProtectedResourceMetadata>(
    createWellKnownUrl(pdsUrl, '/.well-known/oauth-protected-resource'),
    'Failed to load Atmosphere protected resource metadata.',
  )
  let authorizationServers = Array.isArray(resourceMetadata.authorization_servers)
    ? resourceMetadata.authorization_servers.filter(
        (value): value is string => typeof value === 'string',
      )
    : []

  if (authorizationServers.length === 0) {
    throw new Error(
      'Atmosphere protected resource metadata did not include an authorization server.',
    )
  }

  let issuer = validateAuthorizationServerOrigin(authorizationServers[0])
  let metadata = await fetchJson<AtmosphereAuthorizationServerMetadata>(
    createWellKnownUrl(issuer, '/.well-known/oauth-authorization-server'),
    'Failed to load Atmosphere authorization server metadata.',
  )

  return validateAtmosphereAuthorizationServerMetadata(metadata, issuer, confidential)
}

async function resolveAtmosphereIdentity(
  identifier: AtmosphereIdentifier,
): Promise<AtmosphereResolvedIdentity> {
  if (identifier.type === 'did') {
    let document = await resolveDidDocument(identifier.normalized)
    return {
      did: identifier.normalized,
      handle: getClaimedHandle(document),
      pdsUrl: getPdsUrl(document, identifier.normalized),
    }
  }

  let did = await resolveHandleToDid(identifier.normalized)
  let document = await resolveDidDocument(did)
  let claimedHandle = getClaimedHandle(document)

  if (claimedHandle !== identifier.normalized) {
    throw new Error('Atmosphere handle resolution did not match the DID document handle claim.')
  }

  return {
    did,
    handle: claimedHandle,
    pdsUrl: getPdsUrl(document, did),
  }
}

async function resolveHandleToDid(handle: string): Promise<string> {
  let [dnsResult, httpsResult] = await Promise.allSettled([
    resolveHandleViaDns(handle),
    resolveHandleViaHttps(handle),
  ])

  if (dnsResult.status === 'fulfilled' && dnsResult.value != null) {
    return dnsResult.value
  }

  if (httpsResult.status === 'fulfilled' && httpsResult.value != null) {
    return httpsResult.value
  }

  if (dnsResult.status === 'rejected') {
    throw dnsResult.reason
  }

  if (httpsResult.status === 'rejected') {
    throw httpsResult.reason
  }

  throw new Error(`Atmosphere handle resolution failed for "${handle}".`)
}

async function resolveHandleViaDns(handle: string): Promise<string | undefined> {
  let url = new URL(CLOUDFLARE_DNS_ENDPOINT)
  url.searchParams.set('name', `_atproto.${handle}`)
  url.searchParams.set('type', 'TXT')

  let response = await fetch(url, {
    headers: {
      Accept: 'application/dns-json',
    },
  })

  if (!response.ok) {
    return
  }

  let json = (await readJsonResponse(response)) as {
    Answer?: Array<{ data?: unknown; type?: unknown }>
  }
  let didValues = new Set<string>()

  for (let answer of json.Answer ?? []) {
    if (answer.type !== 16 || typeof answer.data !== 'string') {
      continue
    }

    let text = decodeDnsTxtRecord(answer.data)
    if (text.startsWith('did=')) {
      didValues.add(text.slice(4))
    }
  }

  if (didValues.size > 1) {
    throw new Error(`Atmosphere DNS handle resolution returned multiple DIDs for "${handle}".`)
  }

  let did = didValues.values().next().value as string | undefined
  if (did == null) {
    return
  }

  validateDid(did)
  return did
}

async function resolveHandleViaHttps(handle: string): Promise<string | undefined> {
  let response = await fetch(`https://${handle}/.well-known/atproto-did`)

  if (!response.ok) {
    return
  }

  let did = (await response.text()).trim()
  if (did.length === 0) {
    return
  }

  try {
    validateDid(did)
  } catch {
    return
  }

  return did
}

async function resolveDidDocument(did: string): Promise<AtmosphereDidDocument> {
  validateDid(did)

  let document: AtmosphereDidDocument
  if (did.startsWith('did:plc:')) {
    document = await fetchJson<AtmosphereDidDocument>(
      `${PLC_DIRECTORY_URL}${encodeURIComponent(did)}`,
      `Failed to resolve DID document for "${did}".`,
    )
  } else if (did.startsWith('did:web:')) {
    let didWebUrl = createDidWebDocumentUrl(did)
    document = await fetchJson<AtmosphereDidDocument>(
      didWebUrl,
      `Failed to resolve DID document for "${did}".`,
    )
  } else {
    throw new Error(`Unsupported Atmosphere DID method in "${did}".`)
  }

  if (document.id !== did) {
    throw new Error(`Resolved DID document did not match "${did}".`)
  }

  return document
}

function createDidWebDocumentUrl(did: string): string {
  let [encodedHost, ...encodedPath] = did.slice('did:web:'.length).split(':')
  let host = decodeURIComponent(encodedHost ?? '')

  if (host.length === 0 || host.includes('/')) {
    throw new Error(`Unsupported did:web identifier "${did}".`)
  }

  let url = new URL(`${host.startsWith('localhost') ? 'http' : 'https'}://${host}`)

  if (encodedPath.length === 0) {
    url.pathname = '/.well-known/did.json'
    return url.toString()
  }

  let path = encodedPath.map((segment) => decodeURIComponent(segment))
  if (
    path.some(
      (segment) =>
        segment.length === 0 || segment.includes('/') || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(`Unsupported did:web identifier "${did}".`)
  }

  url.pathname = `/${path.join('/')}/did.json`
  return url.toString()
}

function getClaimedHandle(document: AtmosphereDidDocument): string | undefined {
  let alsoKnownAs = Array.isArray(document.alsoKnownAs) ? document.alsoKnownAs : []

  for (let entry of alsoKnownAs) {
    if (typeof entry !== 'string' || !entry.startsWith('at://')) {
      continue
    }

    let handle = entry.slice('at://'.length)

    try {
      return normalizeHandle(handle)
    } catch {
      continue
    }
  }
}

function getPdsUrl(document: AtmosphereDidDocument, did: string): string {
  let services = Array.isArray(document.service) ? document.service : []

  for (let service of services) {
    if (typeof service !== 'object' || service == null || Array.isArray(service)) {
      continue
    }

    let entry = service as Record<string, unknown>
    let id = typeof entry.id === 'string' ? entry.id : undefined
    let type = typeof entry.type === 'string' ? entry.type : undefined
    let endpoint = typeof entry.serviceEndpoint === 'string' ? entry.serviceEndpoint : undefined

    if (
      id != null &&
      matchesDidFragment(id, did, ATPROTO_PDS_SERVICE_ID) &&
      type === ATPROTO_PDS_SERVICE_TYPE &&
      endpoint != null
    ) {
      return normalizeHttpsOrigin(endpoint, 'Atmosphere DID document PDS endpoint')
    }
  }

  throw new Error(`Atmosphere DID document for "${did}" did not include a PDS endpoint.`)
}

function matchesDidFragment(value: string, did: string, fragment: string): boolean {
  return value === fragment || value === `${did}${fragment}`
}

function validateAtmosphereAuthorizationServerMetadata(
  metadata: AtmosphereAuthorizationServerMetadata,
  issuer: string,
  confidential: boolean,
): AtmosphereAuthorizationServerMetadata {
  if (normalizeHttpsOrigin(metadata.issuer, 'Atmosphere authorization server issuer') !== issuer) {
    throw new Error(
      'Atmosphere authorization server metadata issuer did not match the resolved origin.',
    )
  }

  ensureUrl(metadata.authorization_endpoint, issuer, 'Atmosphere authorization endpoint')
  ensureUrl(metadata.token_endpoint, issuer, 'Atmosphere token endpoint')
  ensureUrl(
    metadata.pushed_authorization_request_endpoint,
    undefined,
    'Atmosphere pushed authorization request endpoint',
  )

  ensureIncludes(metadata.response_types_supported, 'code', 'Atmosphere authorization server')
  ensureIncludes(
    metadata.grant_types_supported,
    'authorization_code',
    'Atmosphere authorization server',
  )
  ensureIncludes(metadata.grant_types_supported, 'refresh_token', 'Atmosphere authorization server')
  ensureIncludes(
    metadata.code_challenge_methods_supported,
    'S256',
    'Atmosphere authorization server',
  )
  ensureIncludes(metadata.scopes_supported, 'atproto', 'Atmosphere authorization server')
  ensureIncludes(
    metadata.dpop_signing_alg_values_supported,
    'ES256',
    'Atmosphere authorization server',
  )

  if (metadata.require_pushed_authorization_requests === false) {
    throw new Error('Atmosphere authorization server must require PAR.')
  }

  if (metadata.authorization_response_iss_parameter_supported !== true) {
    throw new Error('Atmosphere authorization server must support the callback iss parameter.')
  }

  if (metadata.client_id_metadata_document_supported !== true) {
    throw new Error('Atmosphere authorization server must support client metadata documents.')
  }

  if (confidential) {
    ensureIncludes(
      metadata.token_endpoint_auth_methods_supported,
      'private_key_jwt',
      'Atmosphere authorization server',
    )
    ensureIncludes(
      metadata.token_endpoint_auth_signing_alg_values_supported,
      'ES256',
      'Atmosphere authorization server',
    )
  } else {
    ensureIncludes(
      metadata.token_endpoint_auth_methods_supported,
      'none',
      'Atmosphere authorization server',
    )
  }

  return metadata
}

function normalizeAtmosphereIdentifier(input: string): AtmosphereIdentifier {
  let value = input.trim()

  if (value.length === 0) {
    throw new Error('Atmosphere auth requires a handle or DID.')
  }

  if (value.startsWith('did:')) {
    validateDid(value)
    return {
      input: value,
      normalized: value,
      type: 'did',
    }
  }

  return {
    input: value,
    normalized: normalizeHandle(value),
    type: 'handle',
  }
}

function normalizeAtmosphereClientConfiguration(
  clientId: string | URL,
  redirectUri: string | URL,
  scopes: string[],
): AtmosphereClientConfiguration {
  let redirect = normalizeRedirectUri(redirectUri)
  let client = new URL(typeof clientId === 'string' ? clientId : clientId.toString())

  if (client.origin === 'http://localhost' && client.port === '') {
    if (client.pathname !== '/' || client.hash.length > 0) {
      throw new Error(
        'Atmosphere loopback client_id must use http://localhost with no path or fragment.',
      )
    }

    if (!redirect.loopback) {
      throw new Error('Atmosphere localhost client_id requires a loopback redirect URI.')
    }

    if (client.searchParams.getAll('redirect_uri').length === 0) {
      client.searchParams.append('redirect_uri', redirect.url.toString())
    }

    let configuredRedirectUris = client.searchParams.getAll('redirect_uri')
    if (!configuredRedirectUris.some((value) => matchesLoopbackRedirect(value, redirect.url))) {
      throw new Error(
        'Atmosphere localhost client_id must declare the configured loopback redirect URI.',
      )
    }

    if (client.searchParams.get('scope') == null) {
      client.searchParams.set('scope', scopes.join(' '))
    }

    let declaredScopes = parseScope(client.searchParams.get('scope')) ?? []
    for (let scope of scopes) {
      if (!declaredScopes.includes(scope)) {
        throw new Error('Atmosphere localhost client_id scope must include every requested scope.')
      }
    }

    return {
      clientId: client.toString(),
      redirectUri: redirect.url.toString(),
      loopback: true,
    }
  }

  if (client.protocol !== 'https:' || client.port !== '' || client.hash.length > 0) {
    throw new Error('Atmosphere client_id must be an https URL with no explicit port or fragment.')
  }

  if (redirect.loopback) {
    throw new Error('Atmosphere loopback redirect URIs require a localhost client_id.')
  }

  return {
    clientId: client.toString(),
    redirectUri: redirect.url.toString(),
    loopback: false,
  }
}

function normalizeRedirectUri(value: string | URL): { url: URL; loopback: boolean } {
  let url = new URL(typeof value === 'string' ? value : value.toString())

  if (url.hostname === 'localhost') {
    throw new Error('Loopback redirect URIs must use 127.0.0.1 or [::1], not localhost.')
  }

  if (url.protocol === 'https:') {
    return {
      url,
      loopback: false,
    }
  }

  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) {
    return {
      url,
      loopback: true,
    }
  }

  throw new Error(
    'Atmosphere redirectUri must be https or an http loopback URL using 127.0.0.1 or [::1].',
  )
}

function matchesLoopbackRedirect(candidate: string, expected: URL): boolean {
  let url = new URL(candidate)
  return (
    url.protocol === expected.protocol &&
    url.hostname === expected.hostname &&
    url.pathname === expected.pathname
  )
}

function normalizeAtmosphereScopes(scopes: string[] | undefined): string[] {
  let normalized = scopes?.filter((scope) => typeof scope === 'string' && scope.length > 0)
  let value = normalized == null || normalized.length === 0 ? DEFAULT_ATMOSPHERE_SCOPES : normalized

  if (!value.includes('atproto')) {
    throw new Error('Atmosphere scopes must include "atproto".')
  }

  return Array.from(new Set(value))
}

function normalizeAtmosphereSessionSecret(secret: string): string {
  let value = secret.trim()

  if (value.length === 0) {
    throw new Error('Atmosphere sessionSecret must not be empty.')
  }

  return value
}

function normalizeHandle(input: string): string {
  let handle = input.trim().toLowerCase()
  let parts = handle.split('.')

  if (!HANDLE_REGEX.test(handle)) {
    throw new Error(`Invalid Atmosphere handle "${input}".`)
  }

  let tld = parts[parts.length - 1]
  if (DISALLOWED_HANDLE_TLDS.has(tld)) {
    throw new Error(`Atmosphere handle "${input}" uses a disallowed top-level domain.`)
  }

  return handle
}

function validateDid(value: string): void {
  if (!DID_REGEX.test(value)) {
    throw new Error(`Invalid Atmosphere DID "${value}".`)
  }
}

function createWellKnownUrl(origin: string, pathname: string): string {
  let url = new URL(pathname, origin)
  return url.toString()
}

function validateAuthorizationServerOrigin(value: string): string {
  return normalizeHttpsOrigin(value, 'Atmosphere authorization server')
}

function normalizeHttpsOrigin(value: string, label: string): string {
  let url = new URL(value)

  if (url.protocol !== 'https:' || url.username.length > 0 || url.password.length > 0) {
    throw new Error(`${label} must be an https origin.`)
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`${label} must not include a path, query string, or fragment.`)
  }

  return url.origin
}

function ensureUrl(value: string, issuer: string | undefined, label: string): string {
  let url = new URL(value)

  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use https.`)
  }

  if (issuer != null && url.origin !== issuer) {
    throw new Error(`${label} must use the resolved authorization server origin.`)
  }

  return url.toString()
}

function ensureIncludes(
  value: string[] | string | undefined,
  expected: string,
  source: string,
): void {
  let values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\s+/) : []

  if (!values.includes(expected)) {
    throw new Error(`${source} did not advertise required value "${expected}".`)
  }
}

async function fetchJson<json>(input: string | URL, fallbackError: string): Promise<json> {
  let response = await fetch(input)
  let json = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(getOAuthErrorMessage(json, fallbackError))
  }

  return json as json
}

async function readJsonResponse(response: Response): Promise<unknown> {
  let text = await response.text()
  if (text.length === 0) {
    return {}
  }

  return JSON.parse(text)
}

function getOAuthErrorMessage(json: unknown, fallback: string): string {
  if (typeof json !== 'object' || json == null || Array.isArray(json)) {
    return fallback
  }

  let data = json as Record<string, unknown>

  if (typeof data.error_description === 'string' && data.error_description.length > 0) {
    return data.error_description
  }

  if (typeof data.error === 'string' && data.error.length > 0) {
    return data.error
  }

  if (typeof data.message === 'string' && data.message.length > 0) {
    return data.message
  }

  return fallback
}

function isUseDpopNonceError(json: unknown): boolean {
  return (
    typeof json === 'object' &&
    json != null &&
    !Array.isArray(json) &&
    (json as Record<string, unknown>).error === 'use_dpop_nonce'
  )
}

function parseScope(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return
  }

  return value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
}

function decodeDnsTxtRecord(value: string): string {
  let matches = value.match(/"((?:[^"\\]|\\.)*)"/g)

  if (matches == null) {
    return value
  }

  return matches
    .map((match) => match.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
    .join('')
}

async function writeAtmosphereSessionState(
  secret: string,
  state: string,
  value: AtmosphereSessionState,
): Promise<string> {
  let iv = crypto.getRandomValues(new Uint8Array(12))
  let key = await importAtmosphereSessionKey(secret)
  let ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: getAtmosphereSessionAdditionalData(state),
    },
    key,
    textEncoder.encode(JSON.stringify(value)),
  )

  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`
}

async function readAtmosphereSessionState(
  secret: string,
  transaction: OAuthTransaction,
): Promise<AtmosphereSessionState> {
  if (typeof transaction.providerState !== 'string' || transaction.providerState.length === 0) {
    throw new Error('Missing Atmosphere session state. Restart the login flow and try again.')
  }

  let [version, encodedIv, encodedCiphertext, ...rest] = transaction.providerState.split('.')

  if (version !== 'v1' || encodedIv == null || encodedCiphertext == null || rest.length > 0) {
    throw new Error('Missing Atmosphere session state. Restart the login flow and try again.')
  }

  let key = await importAtmosphereSessionKey(secret)

  try {
    let plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(fromBase64Url(encodedIv)),
        additionalData: getAtmosphereSessionAdditionalData(transaction.state),
      },
      key,
      toArrayBuffer(fromBase64Url(encodedCiphertext)),
    )

    return JSON.parse(textDecoder.decode(plaintext)) as AtmosphereSessionState
  } catch {
    throw new Error('Invalid Atmosphere session state. Restart the login flow and try again.')
  }
}

async function importAtmosphereSessionKey(secret: string): Promise<CryptoKey> {
  let digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret))

  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function getAtmosphereSessionAdditionalData(state: string): ArrayBuffer {
  return toArrayBuffer(textEncoder.encode(`atmosphere:${state}`))
}

function base64UrlEncodeJson(value: Record<string, unknown>): string {
  return toBase64Url(textEncoder.encode(JSON.stringify(value)))
}

function fromBase64Url(value: string): Uint8Array {
  let padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding

  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function toBase64Url(bytes: Uint8Array): string {
  let text = ''

  for (let index = 0; index < bytes.length; index += 3) {
    let chunk =
      ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)

    text += base64Chars[(chunk >> 18) & 0x3f]
    text += base64Chars[(chunk >> 12) & 0x3f]
    text += index + 1 < bytes.length ? base64Chars[(chunk >> 6) & 0x3f] : '='
    text += index + 2 < bytes.length ? base64Chars[chunk & 0x3f] : '='
  }

  return text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
