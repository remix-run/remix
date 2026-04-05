import type { OAuthDpopBinding, OAuthDpopTokens, OAuthTokens } from 'remix/auth'
import type { Database } from 'remix/data-table'

import { authAccountTokens, type AuthAccount } from '../data/schema.ts'
import { sessionSecret } from '../middleware/session.ts'
import {
  externalProviderRegistry,
  refreshExternalProviderTokens,
  type ExternalProviderRegistry,
} from './external-auth.ts'
import { sealJson, unsealJson } from './sealed-json.ts'

const TOKEN_EXPIRY_SKEW_MS = 60_000
const TOKEN_SCOPE = 'social-auth:auth-account-tokens'

export interface ExternalTokenState {
  available: boolean
  refreshed: boolean
  expired: boolean
  hasRefreshToken: boolean
  expiresAt?: string
  tokenType?: string
  scope?: string[]
  hasDpopBinding: boolean
  dpopNonce?: 'present' | 'missing'
  refreshError?: string
}

interface StoredOAuthTokens {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  scope?: string[]
  idToken?: string
  dpop?: OAuthDpopBinding
}

/**
 * Persists the latest external token bundle for a linked auth account.
 *
 * The demo keeps this app-owned on purpose: callback routes store the raw provider
 * tokens once, and later requests can load and refresh them only when needed.
 */
export async function persistAuthAccountTokens(
  db: Database,
  authAccountId: number,
  tokens: OAuthTokens,
): Promise<void> {
  let existingTokens = await db.findOne(authAccountTokens, {
    where: { auth_account_id: authAccountId },
  })
  let encryptedTokenJson = await sealJson(serializeTokens(tokens), sessionSecret, TOKEN_SCOPE)
  let expiresAt = tokens.expiresAt?.getTime()

  if (existingTokens == null) {
    await db.create(authAccountTokens, {
      auth_account_id: authAccountId,
      encrypted_token_json: encryptedTokenJson,
      expires_at: expiresAt,
    })
    return
  }

  await db.update(authAccountTokens, existingTokens.id, {
    encrypted_token_json: encryptedTokenJson,
    expires_at: expiresAt,
  })
}

/**
 * Loads the stored token bundle for a linked auth account and refreshes it on demand
 * when it is expired and a refresh token is available.
 */
export async function getUsableAuthAccountTokens(
  db: Database,
  authAccount: AuthAccount,
  registry: ExternalProviderRegistry = externalProviderRegistry,
): Promise<{ tokens: OAuthTokens | null; state: ExternalTokenState | null }> {
  let tokens = await readStoredAuthAccountTokens(db, authAccount.id)
  if (tokens == null) {
    return {
      tokens: null,
      state: null,
    }
  }

  let refreshed = false
  let refreshError: string | undefined

  if (isExpired(tokens.expiresAt) && hasRefreshToken(tokens)) {
    try {
      tokens = await refreshAuthAccountTokens(authAccount, tokens, registry)
      await persistAuthAccountTokens(db, authAccount.id, tokens)
      refreshed = true
    } catch (error) {
      refreshError = error instanceof Error ? error.message : 'Unable to refresh external tokens.'
    }
  }

  return {
    tokens,
    state: createExternalTokenState(tokens, refreshed, refreshError),
  }
}

/**
 * Reads the stored token bundle exactly as persisted, without attempting refresh.
 */
export async function readStoredAuthAccountTokens(
  db: Database,
  authAccountId: number,
): Promise<OAuthTokens | null> {
  let storedTokens = await db.findOne(authAccountTokens, {
    where: { auth_account_id: authAccountId },
  })
  if (storedTokens == null) {
    return null
  }

  let value = await unsealJson<StoredOAuthTokens>(
    storedTokens.encrypted_token_json,
    sessionSecret,
    TOKEN_SCOPE,
  )

  return parseTokens(value, storedTokens.expires_at)
}

function createExternalTokenState(
  tokens: OAuthTokens,
  refreshed: boolean,
  refreshError?: string,
): ExternalTokenState {
  let dpopTokens = isDpopTokens(tokens) ? tokens : null

  return {
    available: true,
    refreshed,
    expired: isExpired(tokens.expiresAt),
    hasRefreshToken: hasRefreshToken(tokens),
    expiresAt: tokens.expiresAt?.toISOString(),
    tokenType: tokens.tokenType,
    scope: tokens.scope,
    hasDpopBinding: dpopTokens != null,
    dpopNonce:
      dpopTokens != null ? (dpopTokens.dpop.nonce != null ? 'present' : 'missing') : undefined,
    refreshError,
  }
}

async function refreshAuthAccountTokens(
  authAccount: AuthAccount,
  tokens: OAuthTokens,
  registry: ExternalProviderRegistry,
): Promise<OAuthTokens> {
  return refreshExternalProviderTokens(authAccount, tokens, registry)
}

function serializeTokens(tokens: OAuthTokens): StoredOAuthTokens {
  if (isDpopTokens(tokens)) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'DPoP',
      scope: tokens.scope,
      idToken: tokens.idToken,
      dpop: tokens.dpop,
    }
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: tokens.tokenType,
    scope: tokens.scope,
    idToken: tokens.idToken,
  }
}

function parseTokens(
  value: StoredOAuthTokens | null,
  expiresAt: number | undefined,
): OAuthTokens | null {
  if (value == null || typeof value.accessToken !== 'string' || value.accessToken.length === 0) {
    return null
  }

  let base = {
    accessToken: value.accessToken,
    refreshToken:
      typeof value.refreshToken === 'string' && value.refreshToken.length > 0
        ? value.refreshToken
        : undefined,
    expiresAt: typeof expiresAt === 'number' ? new Date(expiresAt) : undefined,
    scope: Array.isArray(value.scope)
      ? value.scope.filter(
          (entry): entry is string => typeof entry === 'string' && entry.length > 0,
        )
      : undefined,
    idToken:
      typeof value.idToken === 'string' && value.idToken.length > 0 ? value.idToken : undefined,
  }

  if (value.tokenType === 'DPoP') {
    let dpop = parseDpopBinding(value.dpop)
    if (dpop == null) {
      return null
    }

    return {
      ...base,
      tokenType: 'DPoP',
      dpop,
    }
  }

  return {
    ...base,
    tokenType: typeof value.tokenType === 'string' ? value.tokenType : undefined,
  }
}

function parseDpopBinding(value: unknown): OAuthDpopBinding | null {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return null
  }

  let dpop = value as OAuthDpopBinding
  if (typeof dpop.publicJwk !== 'object' || dpop.publicJwk == null) {
    return null
  }

  if (typeof dpop.privateJwk !== 'object' || dpop.privateJwk == null) {
    return null
  }

  return {
    publicJwk: dpop.publicJwk,
    privateJwk: dpop.privateJwk,
    nonce: typeof dpop.nonce === 'string' ? dpop.nonce : undefined,
  }
}

function isDpopTokens(tokens: OAuthTokens): tokens is OAuthDpopTokens {
  return tokens.tokenType === 'DPoP' && tokens.dpop != null
}

function hasRefreshToken(tokens: OAuthTokens): boolean {
  return typeof tokens.refreshToken === 'string' && tokens.refreshToken.trim().length > 0
}

function isExpired(expiresAt: Date | undefined): boolean {
  if (expiresAt == null) {
    return false
  }

  return expiresAt.getTime() <= Date.now() + TOKEN_EXPIRY_SKEW_MS
}
