import type { Session } from '@remix-run/session'
import type {
  Feature,
  FeatureContext,
  FeatureSchema,
  FeatureRoutes,
  FeatureHandlers,
  OperationDefinition,
  OperationResult,
} from '../types.ts'
import type { AuthUser, AuthAccount } from '../../types.ts'
import { setAuthFlash, getAuthFlash, type OAuthFlash } from '../../flash.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Error codes returned by OAuth operations
 */
export type OAuthErrorCode =
  | 'provider_not_found'
  | 'user_not_found'
  | 'account_not_found'
  | 'account_exists_unverified_email'
  | 'access_denied'
  | 'invalid_state'
  | 'missing_code'
  | 'provider_error'
  | 'token_refresh_failed'
  | 'not_authenticated'
  | 'cannot_unlink_last_account'
  | 'unknown_error'

/**
 * OAuth 2.0 Provider Interface
 */
export interface OAuthProvider {
  /**
   * Provider identifier (e.g., 'github', 'google')
   */
  name: string

  /**
   * Display name for UI (e.g., 'GitHub', 'Google')
   */
  displayName: string

  /**
   * Get the authorization URL to redirect the user to
   */
  getAuthorizationUrl(options: {
    clientId: string
    redirectUri: string
    state: string
    scopes?: string[]
  }): string

  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(options: {
    clientId: string
    clientSecret: string
    code: string
    redirectUri: string
  }): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    scopes?: string[]
  }>

  /**
   * Refresh an access token using refresh token
   */
  refreshAccessToken?(options: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn?: number
    scopes?: string[]
  }>

  /**
   * Fetch user profile from the provider
   */
  getUserProfile(accessToken: string): Promise<{
    id: string
    email: string
    emailVerified?: boolean
    name?: string
    avatarUrl?: string
  }>
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  provider: OAuthProvider
  clientId: string
  clientSecret: string
  scopes?: string[]
}

// ============================================================================
// State Management
// ============================================================================

interface OAuthStateData {
  createdAt: number
  callbackURL: string
  errorCallbackURL?: string
  newUserCallbackURL?: string
  scopes?: string[]
  isLinking?: boolean
  userId?: string // For linking - the user who is linking
}

/**
 * Generate a secure random state parameter for OAuth CSRF protection
 */
function generateState(): string {
  let bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

let oauthStates = new Map<string, OAuthStateData>()

if (process.env.NODE_ENV !== 'test') {
  let cleanupInterval = setInterval(() => {
    let now = Date.now()
    for (let [state, data] of oauthStates.entries()) {
      if (now - data.createdAt > 600000) {
        oauthStates.delete(state)
      }
    }
  }, 60000)
  cleanupInterval.unref()
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * OAuth feature configuration
 */
export interface OAuthFeatureConfig {
  enabled: true
  providers: Record<string, OAuthProviderConfig>
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * OAuth route definitions
 * sign-in/link are POST (stateful operations), callback is GET (OAuth redirect)
 */
export let oauthRoutes = {
  signIn: { method: 'POST' as const, pattern: '/sign-in/:provider' },
  link: { method: 'POST' as const, pattern: '/link/:provider' },
  unlink: { method: 'POST' as const, pattern: '/unlink/:provider' },
  callback: { method: 'GET' as const, pattern: '/callback/:provider' },
} satisfies FeatureRoutes

// ============================================================================
// Provider Helper Types
// ============================================================================

export interface OAuthSignInOptions {
  callbackURL: string
  errorCallbackURL?: string
  newUserCallbackURL?: string
  scopes?: string[]
}

export interface OAuthLinkOptions {
  callbackURL: string
  errorCallbackURL?: string
  scopes?: string[]
}

export interface OAuthFormData {
  action: string
  method: 'POST'
  inputs: Array<{ name: string; value: string }>
}

/**
 * Error codes for getAccessToken
 */
export type OAuthAccessTokenErrorCode = 'not_linked' | 'token_refresh_failed'

/**
 * Result of getAccessToken
 */
export type OAuthAccessTokenResult =
  | {
      type: 'success'
      code: 'token_retrieved'
      data: { accessToken: string; scopes: string[]; expiresAt?: Date }
    }
  | { type: 'error'; code: OAuthAccessTokenErrorCode }

/**
 * Helper object for a configured OAuth provider
 *
 * @example
 * ```typescript
 * // Get access token for API calls
 * let result = await authClient.oauth.github.getAccessToken({ userId: user.id })
 * if (result.type === 'success') {
 *   let repos = await fetch('https://api.github.com/user/repos', {
 *     headers: { Authorization: `Bearer ${result.data.accessToken}` }
 *   })
 * }
 *
 * // Render sign-in form
 * let form = authClient.oauth.github.getSignInForm({ callbackURL: '/' })
 * ```
 */
export interface OAuthProviderHelper {
  /** Provider identifier (e.g., 'github') */
  name: string
  /** Display name for UI (e.g., 'GitHub') */
  displayName: string

  /**
   * Get a valid access token for third-party API calls.
   * Auto-refreshes if expired and refresh token is available.
   */
  getAccessToken(args: { userId: string; accountId?: string }): Promise<OAuthAccessTokenResult>

  /** Get form data for sign-in */
  getSignInForm(options: OAuthSignInOptions): OAuthFormData

  /** Get form data for linking */
  getLinkForm(options: OAuthLinkOptions): OAuthFormData

  /** Get form data for unlinking */
  getUnlinkForm(accountId?: string): OAuthFormData
}

// ============================================================================
// Operation Definitions
// ============================================================================

export type OAuthSignInSuccessType = 'sign_in' | 'sign_up' | 'account_linked'

interface SignInArgs {
  session: Session
  request: Request
  provider: string
  providerAccountId: string
  email: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  scopes?: string[]
  emailVerified?: boolean
  name?: string
  image?: string
  [key: string]: unknown
}

export interface OAuthOperationsDef {
  /**
   * Internal sign-in operation (used by callback handler and tests)
   */
  signIn: OperationDefinition<
    SignInArgs,
    OAuthSignInSuccessType,
    { user: AuthUser },
    OAuthErrorCode
  >

  /**
   * Unlink an OAuth account (programmatic)
   */
  unlink: OperationDefinition<
    { session: Session; provider: string; accountId?: string },
    'unlinked',
    {},
    OAuthErrorCode
  >
}

// ============================================================================
// Public API Types
// ============================================================================

export interface OAuthOperations {
  /**
   * Internal sign-in operation (used by callback handler and tests)
   */
  signIn(
    args: SignInArgs,
  ): Promise<OperationResult<OAuthSignInSuccessType, { user: AuthUser }, OAuthErrorCode>>

  unlink(args: {
    session: Session
    provider: string
    accountId?: string
  }): Promise<OperationResult<'unlinked', {}, OAuthErrorCode>>
}

/**
 * OAuth feature helpers - providers keyed by name for direct access
 *
 * @example
 * ```typescript
 * // Direct provider access
 * let result = await authClient.oauth.github.getAccessToken({ userId })
 * let form = authClient.oauth.github.getSignInForm({ callbackURL: '/' })
 *
 * // Iterate all providers
 * Object.values(authClient.oauth.providers).map(provider => ...)
 * ```
 */
export interface OAuthHelpers {
  /**
   * Configured OAuth providers keyed by name
   */
  providers: Record<string, OAuthProviderHelper>

  /**
   * Get flash message from OAuth redirect
   */
  getFlash(session: Session): OAuthFlash | null
}

/**
 * Combined OAuth feature methods
 * Includes operations, helpers, and direct provider access (e.g., authClient.oauth.github)
 */
export type OAuthFeatureMethods = OAuthOperations &
  OAuthHelpers &
  Record<string, OAuthProviderHelper>

// ============================================================================
// Feature Implementation
// ============================================================================

export const oauthFeature: Feature<
  OAuthFeatureConfig,
  OAuthOperationsDef,
  OAuthHelpers,
  typeof oauthRoutes
> = {
  name: 'oauth',
  routes: oauthRoutes,

  isEnabled(config: any): config is OAuthFeatureConfig {
    return (
      config?.oauth?.enabled === true &&
      config?.oauth?.providers &&
      Object.keys(config.oauth.providers).length > 0
    )
  },

  getSchema(): FeatureSchema {
    return {
      models: [
        {
          name: 'authAccount',
          fields: {
            id: { type: 'string', required: true },
            userId: { type: 'string', required: true },
            strategy: { type: 'string', required: true },
            provider: { type: 'string', required: false },
            accountId: { type: 'string', required: false },
            accessToken: { type: 'string', required: false },
            refreshToken: { type: 'string', required: false },
            accessTokenExpiresAt: { type: 'date', required: false },
            refreshTokenExpiresAt: { type: 'date', required: false },
            scopes: { type: 'string', required: false },
            createdAt: { type: 'date', required: true },
            updatedAt: { type: 'date', required: true },
          },
        },
      ],
    }
  },

  getHandlers(context: FeatureContext): FeatureHandlers<typeof oauthRoutes> {
    let { config, storage, sessionKey } = context
    let oauthConfig = config.oauth as OAuthFeatureConfig

    return {
      /**
       * POST /sign-in/:provider
       * Initiates OAuth sign-in flow
       */
      async signIn({ request, params, formData }) {
        let providerName = params.provider
        let providerConfig = oauthConfig.providers[providerName]

        if (!providerConfig) {
          return new Response(JSON.stringify({ error: 'provider_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let callbackURL = formData?.get('callbackURL') as string | null
        let errorCallbackURL = formData?.get('errorCallbackURL') as string | null
        let newUserCallbackURL = formData?.get('newUserCallbackURL') as string | null
        let scopesParam = formData?.get('scopes') as string | null

        if (!callbackURL) {
          return new Response(JSON.stringify({ error: 'callbackURL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let scopes = scopesParam ? scopesParam.split(',') : providerConfig.scopes

        let { provider, clientId } = providerConfig
        let state = generateState()
        oauthStates.set(state, {
          createdAt: Date.now(),
          callbackURL,
          errorCallbackURL: errorCallbackURL || undefined,
          newUserCallbackURL: newUserCallbackURL || undefined,
          scopes,
          isLinking: false,
        })

        let baseUrl = context.getBaseURL(request)
        let redirectUri = `${baseUrl}${context.routes.callback.href({ provider: providerName })}`

        let authUrl = provider.getAuthorizationUrl({
          clientId,
          redirectUri,
          state,
          scopes: scopes || [],
        })

        return new Response(null, {
          status: 302,
          headers: { Location: authUrl },
        })
      },

      /**
       * POST /link/:provider
       * Initiates OAuth account linking for logged-in user
       */
      async link({ request, session, params, formData }) {
        let userId = session.get(sessionKey) as string | undefined
        if (!userId) {
          return new Response(JSON.stringify({ error: 'not_authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let providerName = params.provider
        let providerConfig = oauthConfig.providers[providerName]

        if (!providerConfig) {
          return new Response(JSON.stringify({ error: 'provider_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let callbackURL = formData?.get('callbackURL') as string | null
        let errorCallbackURL = formData?.get('errorCallbackURL') as string | null
        let scopesParam = formData?.get('scopes') as string | null

        if (!callbackURL) {
          return new Response(JSON.stringify({ error: 'callbackURL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let scopes = scopesParam ? scopesParam.split(',') : providerConfig.scopes

        let { provider, clientId } = providerConfig
        let state = generateState()
        oauthStates.set(state, {
          createdAt: Date.now(),
          callbackURL,
          errorCallbackURL: errorCallbackURL || undefined,
          scopes,
          isLinking: true,
          userId,
        })

        let baseUrl = context.getBaseURL(request)
        let redirectUri = `${baseUrl}${context.routes.callback.href({ provider: providerName })}`

        let authUrl = provider.getAuthorizationUrl({
          clientId,
          redirectUri,
          state,
          scopes: scopes || [],
        })

        return new Response(null, {
          status: 302,
          headers: { Location: authUrl },
        })
      },

      /**
       * POST /unlink/:provider
       * Unlinks an OAuth account
       */
      async unlink({ request, session, params, formData }) {
        let userId = session.get(sessionKey) as string | undefined
        if (!userId) {
          return new Response(JSON.stringify({ error: 'not_authenticated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let providerName = params.provider

        // Get optional accountId from form data
        let accountId = formData?.get('accountId') as string | null

        // Check total accounts
        let allAccounts = await storage.findMany<AuthAccount>({
          model: 'authAccount',
          where: [{ field: 'userId', value: userId }],
        })

        if (allAccounts.length <= 1) {
          return new Response(JSON.stringify({ error: 'cannot_unlink_last_account' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Find the account to unlink
        let whereConditions: Array<{ field: string; value: string }> = [
          { field: 'userId', value: userId },
          { field: 'strategy', value: 'oauth' },
          { field: 'provider', value: providerName },
        ]
        if (accountId) {
          whereConditions.push({ field: 'accountId', value: accountId })
        }

        let account = await storage.findOne<AuthAccount>({
          model: 'authAccount',
          where: whereConditions,
        })

        if (!account) {
          return new Response(JSON.stringify({ error: 'account_not_found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        await storage.delete({
          model: 'authAccount',
          where: [{ field: 'id', value: account.id }],
        })

        // Redirect back to referrer or return success
        let referer = request.headers.get('Referer')
        if (referer) {
          return new Response(null, {
            status: 302,
            headers: { Location: referer },
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },

      /**
       * GET /callback/:provider
       * Handles OAuth callback from provider
       */
      async callback({ request, session, params }) {
        let providerName = params.provider
        let url = new URL(request.url)
        let code = url.searchParams.get('code')
        let state = url.searchParams.get('state')
        let error = url.searchParams.get('error')

        let providerConfig = oauthConfig.providers[providerName]
        if (!providerConfig) {
          return new Response('Provider not found', { status: 404 })
        }

        // Get state data
        let stateData = state ? oauthStates.get(state) : null
        if (!stateData) {
          return new Response('Invalid state', { status: 400 })
        }
        oauthStates.delete(state!)

        let {
          callbackURL,
          errorCallbackURL,
          newUserCallbackURL,
          isLinking,
          userId: linkingUserId,
        } = stateData
        let errorRedirect = errorCallbackURL || callbackURL

        let { provider, clientId, clientSecret } = providerConfig

        if (error) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: error === 'access_denied' ? 'access_denied' : 'provider_error',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: errorRedirect },
          })
        }

        if (!code) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'missing_code',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: errorRedirect },
          })
        }

        try {
          let baseUrl = context.getBaseURL(request)
          let redirectUri = `${baseUrl}${context.routes.callback.href({ provider: providerName })}`

          let tokenData = await provider.exchangeCodeForToken({
            clientId,
            clientSecret,
            code,
            redirectUri,
          })

          let oauthProfile = await provider.getUserProfile(tokenData.accessToken)
          let grantedScopes = tokenData.scopes || stateData.scopes || []

          // Check if this OAuth account already exists
          let existingAccount = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: [
              { field: 'strategy', value: 'oauth' },
              { field: 'provider', value: providerName },
              { field: 'accountId', value: oauthProfile.id },
            ],
          })

          let user: AuthUser
          let resultType: 'sign_in' | 'sign_up' | 'account_linked'

          if (isLinking && linkingUserId) {
            // Linking flow - user is already logged in
            if (existingAccount) {
              if (existingAccount.userId === linkingUserId) {
                // Already linked to this user, just update tokens
                await storage.update({
                  model: 'authAccount',
                  where: [{ field: 'id', value: existingAccount.id }],
                  data: {
                    accessToken: tokenData.accessToken,
                    refreshToken: tokenData.refreshToken,
                    accessTokenExpiresAt: tokenData.expiresIn
                      ? new Date(Date.now() + tokenData.expiresIn * 1000)
                      : undefined,
                    scopes: grantedScopes.join(','),
                    updatedAt: new Date(),
                  },
                })
                resultType = 'account_linked'
              } else {
                // This OAuth account is linked to a different user
                setAuthFlash(session, {
                  feature: 'oauth',
                  route: 'callback',
                  type: 'error',
                  code: 'account_exists_unverified_email',
                })
                return new Response(null, {
                  status: 302,
                  headers: { Location: errorRedirect },
                })
              }
            } else {
              // Create new account link
              let now = new Date()
              await storage.create<AuthAccount>({
                model: 'authAccount',
                data: {
                  userId: linkingUserId,
                  strategy: 'oauth',
                  provider: providerName,
                  accountId: oauthProfile.id,
                  accessToken: tokenData.accessToken,
                  refreshToken: tokenData.refreshToken,
                  accessTokenExpiresAt: tokenData.expiresIn
                    ? new Date(Date.now() + tokenData.expiresIn * 1000)
                    : undefined,
                  scopes: grantedScopes.join(','),
                  createdAt: now,
                  updatedAt: now,
                },
              })
              resultType = 'account_linked'
            }

            let existingUser = await storage.findOne<AuthUser>({
              model: 'authUser',
              where: [{ field: 'id', value: linkingUserId }],
            })
            user = existingUser!
          } else {
            // Sign-in flow
            if (existingAccount) {
              let existingUser = await storage.findOne<AuthUser>({
                model: 'authUser',
                where: [{ field: 'id', value: existingAccount.userId }],
              })
              if (!existingUser) {
                throw new Error('User not found for OAuth account')
              }

              // Update tokens
              await storage.update({
                model: 'authAccount',
                where: [{ field: 'id', value: existingAccount.id }],
                data: {
                  accessToken: tokenData.accessToken,
                  refreshToken: tokenData.refreshToken,
                  accessTokenExpiresAt: tokenData.expiresIn
                    ? new Date(Date.now() + tokenData.expiresIn * 1000)
                    : undefined,
                  scopes: grantedScopes.join(','),
                  updatedAt: new Date(),
                },
              })

              // Update email verification if OAuth provider verified it
              if (
                oauthProfile.emailVerified &&
                !existingUser.emailVerified &&
                oauthProfile.email.toLowerCase().trim() === existingUser.email
              ) {
                existingUser = await storage.update<AuthUser>({
                  model: 'authUser',
                  where: [{ field: 'id', value: existingUser.id }],
                  data: { emailVerified: true, updatedAt: new Date() },
                })
              }

              user = existingUser
              resultType = 'sign_in'
            } else {
              let email = oauthProfile.email.toLowerCase().trim()
              let existingUser = await storage.findOne<AuthUser>({
                model: 'authUser',
                where: [{ field: 'email', value: email }],
              })

              if (existingUser) {
                // User exists with same email - link account
                if (!oauthProfile.emailVerified) {
                  setAuthFlash(session, {
                    feature: 'oauth',
                    route: 'callback',
                    type: 'error',
                    code: 'account_exists_unverified_email',
                  })
                  return new Response(null, {
                    status: 302,
                    headers: { Location: errorRedirect },
                  })
                }

                if (!existingUser.emailVerified && email === existingUser.email) {
                  existingUser = await storage.update<AuthUser>({
                    model: 'authUser',
                    where: [{ field: 'id', value: existingUser.id }],
                    data: { emailVerified: true, updatedAt: new Date() },
                  })
                }

                user = existingUser
                resultType = 'account_linked'
              } else {
                // New user
                let now = new Date()
                user = await storage.create<AuthUser>({
                  model: 'authUser',
                  data: {
                    email,
                    name: oauthProfile.name || oauthProfile.email.split('@')[0],
                    image: oauthProfile.avatarUrl,
                    emailVerified: oauthProfile.emailVerified ?? false,
                    createdAt: now,
                    updatedAt: now,
                  },
                })
                resultType = 'sign_up'
              }

              // Create OAuth account
              let now = new Date()
              await storage.create<AuthAccount>({
                model: 'authAccount',
                data: {
                  userId: user.id,
                  strategy: 'oauth',
                  provider: providerName,
                  accountId: oauthProfile.id,
                  accessToken: tokenData.accessToken,
                  refreshToken: tokenData.refreshToken,
                  accessTokenExpiresAt: tokenData.expiresIn
                    ? new Date(Date.now() + tokenData.expiresIn * 1000)
                    : undefined,
                  scopes: grantedScopes.join(','),
                  createdAt: now,
                  updatedAt: now,
                },
              })
            }

            session.regenerateId(true)
            session.set(sessionKey, user.id)

            if (resultType === 'sign_up' && context.onUserCreatedHook) {
              await context.onUserCreatedHook({ user, request })
            }
          }

          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'success',
            code: resultType,
          })

          let redirectUrl =
            resultType === 'sign_up' && newUserCallbackURL ? newUserCallbackURL : callbackURL

          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl },
          })
        } catch (err) {
          console.error('OAuth callback error:', err)
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'unknown_error',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: errorRedirect },
          })
        }
      },
    }
  },

  createOperations(context): OAuthOperationsDef {
    let { config, storage, sessionKey } = context
    let oauthConfig = config.oauth as OAuthFeatureConfig

    return {
      signIn: {
        rateLimit: { window: 60, max: 10 },
        async handler({
          session,
          request,
          provider,
          providerAccountId,
          email,
          accessToken,
          refreshToken,
          expiresIn,
          scopes,
          emailVerified,
          name,
          image,
          ...extraData
        }) {
          if (!oauthConfig.providers[provider]) {
            return { type: 'error', code: 'provider_not_found' }
          }

          email = email.toLowerCase().trim()
          let grantedScopes = scopes || oauthConfig.providers[provider].scopes || []

          let existingAccount = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: [
              { field: 'strategy', value: 'oauth' },
              { field: 'provider', value: provider },
              { field: 'accountId', value: providerAccountId },
            ],
          })

          let user: AuthUser
          let type: OAuthSignInSuccessType

          if (existingAccount) {
            let existingUser = await storage.findOne<AuthUser>({
              model: 'authUser',
              where: [{ field: 'id', value: existingAccount.userId }],
            })
            if (!existingUser) {
              return { type: 'error', code: 'user_not_found' }
            }

            if (accessToken) {
              await storage.update({
                model: 'authAccount',
                where: [
                  { field: 'userId', value: existingUser.id },
                  { field: 'strategy', value: 'oauth' },
                  { field: 'provider', value: provider },
                ],
                data: {
                  accessToken,
                  refreshToken: refreshToken || undefined,
                  accessTokenExpiresAt: expiresIn
                    ? new Date(Date.now() + expiresIn * 1000)
                    : undefined,
                  scopes: grantedScopes.join(','),
                  updatedAt: new Date(),
                },
              })
            }

            if (emailVerified && !existingUser.emailVerified && email === existingUser.email) {
              existingUser = await storage.update<AuthUser>({
                model: 'authUser',
                where: [{ field: 'id', value: existingUser.id }],
                data: { emailVerified: true, updatedAt: new Date() },
              })
            }

            user = existingUser
            type = 'sign_in'
          } else {
            let existingUser = await storage.findOne<AuthUser>({
              model: 'authUser',
              where: [{ field: 'email', value: email }],
            })

            if (existingUser) {
              if (!emailVerified) {
                return { type: 'error', code: 'account_exists_unverified_email' }
              }

              if (!existingUser.emailVerified && email === existingUser.email) {
                existingUser = await storage.update<AuthUser>({
                  model: 'authUser',
                  where: [{ field: 'id', value: existingUser.id }],
                  data: { emailVerified: true, updatedAt: new Date() },
                })
              }

              user = existingUser
              type = 'account_linked'
            } else {
              let now = new Date()
              user = await storage.create<AuthUser>({
                model: 'authUser',
                data: {
                  email,
                  name: name || email.split('@')[0],
                  image: image || undefined,
                  emailVerified: emailVerified ?? false,
                  createdAt: now,
                  updatedAt: now,
                  ...extraData,
                },
              })
              type = 'sign_up'
            }

            let now = new Date()
            await storage.create<AuthAccount>({
              model: 'authAccount',
              data: {
                userId: user.id,
                strategy: 'oauth',
                provider,
                accountId: providerAccountId,
                accessToken: accessToken || undefined,
                refreshToken: refreshToken || undefined,
                accessTokenExpiresAt: expiresIn
                  ? new Date(Date.now() + expiresIn * 1000)
                  : undefined,
                scopes: grantedScopes.join(','),
                createdAt: now,
                updatedAt: now,
              },
            })
          }

          session.regenerateId(true)
          session.set(sessionKey, user.id)

          if (type === 'sign_up' && context.onUserCreatedHook) {
            await context.onUserCreatedHook({ user, request })
          }

          return { type: 'success', code: type, data: { user } }
        },
      },

      unlink: {
        rateLimit: { window: 60, max: 10 },
        async handler({ session, provider, accountId }) {
          let userId = session.get(context.sessionKey) as string | undefined
          if (!userId) {
            return { type: 'error', code: 'not_authenticated' }
          }

          // Check total accounts
          let allAccounts = await storage.findMany<AuthAccount>({
            model: 'authAccount',
            where: [{ field: 'userId', value: userId }],
          })

          if (allAccounts.length <= 1) {
            return { type: 'error', code: 'cannot_unlink_last_account' }
          }

          // Find the account to unlink
          let whereConditions: Array<{ field: string; value: string }> = [
            { field: 'userId', value: userId },
            { field: 'strategy', value: 'oauth' },
            { field: 'provider', value: provider },
          ]
          if (accountId) {
            whereConditions.push({ field: 'accountId', value: accountId })
          }

          let account = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: whereConditions,
          })

          if (!account) {
            return { type: 'error', code: 'account_not_found' }
          }

          await storage.delete({
            model: 'authAccount',
            where: [{ field: 'id', value: account.id }],
          })

          return { type: 'success', code: 'unlinked', data: {} }
        },
      },
    }
  },

  createHelpers(context): OAuthHelpers {
    let { config, storage } = context
    let oauthConfig = config.oauth as OAuthFeatureConfig

    function createProviderHelper(providerName: string): OAuthProviderHelper {
      let providerConfig = oauthConfig.providers[providerName]

      return {
        name: providerName,
        displayName: providerConfig.provider.displayName,

        async getAccessToken({ userId, accountId }): Promise<OAuthAccessTokenResult> {
          // Find the account
          let whereConditions: Array<{ field: string; value: string }> = [
            { field: 'userId', value: userId },
            { field: 'strategy', value: 'oauth' },
            { field: 'provider', value: providerName },
          ]
          if (accountId) {
            whereConditions.push({ field: 'accountId', value: accountId })
          }

          let account = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: whereConditions,
          })

          if (!account) {
            return { type: 'error', code: 'not_linked' }
          }

          // Check if token is expired and needs refresh
          let needsRefresh =
            account.accessTokenExpiresAt &&
            new Date(account.accessTokenExpiresAt).getTime() - Date.now() < 5000 // 5 second buffer

          if (needsRefresh && account.refreshToken && providerConfig.provider.refreshAccessToken) {
            // Refresh the token
            try {
              let newTokens = await providerConfig.provider.refreshAccessToken({
                clientId: providerConfig.clientId,
                clientSecret: providerConfig.clientSecret,
                refreshToken: account.refreshToken,
              })

              account = await storage.update<AuthAccount>({
                model: 'authAccount',
                where: [{ field: 'id', value: account.id }],
                data: {
                  accessToken: newTokens.accessToken,
                  refreshToken: newTokens.refreshToken || account.refreshToken,
                  accessTokenExpiresAt: newTokens.expiresIn
                    ? new Date(Date.now() + newTokens.expiresIn * 1000)
                    : undefined,
                  scopes: newTokens.scopes?.join(',') || account.scopes,
                  updatedAt: new Date(),
                },
              })
            } catch (err) {
              return { type: 'error', code: 'token_refresh_failed' }
            }
          }

          return {
            type: 'success',
            code: 'token_retrieved',
            data: {
              accessToken: account.accessToken!,
              expiresAt: account.accessTokenExpiresAt,
              scopes: account.scopes?.split(',') || [],
            },
          }
        },

        getSignInForm(options: OAuthSignInOptions): OAuthFormData {
          let inputs: Array<{ name: string; value: string }> = [
            { name: 'callbackURL', value: options.callbackURL },
          ]
          if (options.errorCallbackURL) {
            inputs.push({ name: 'errorCallbackURL', value: options.errorCallbackURL })
          }
          if (options.newUserCallbackURL) {
            inputs.push({ name: 'newUserCallbackURL', value: options.newUserCallbackURL })
          }
          if (options.scopes && options.scopes.length > 0) {
            inputs.push({ name: 'scopes', value: options.scopes.join(',') })
          }
          return {
            action: context.routes.signIn.href({ provider: providerName }),
            method: 'POST',
            inputs,
          }
        },

        getLinkForm(options: OAuthLinkOptions): OAuthFormData {
          let inputs: Array<{ name: string; value: string }> = [
            { name: 'callbackURL', value: options.callbackURL },
          ]
          if (options.errorCallbackURL) {
            inputs.push({ name: 'errorCallbackURL', value: options.errorCallbackURL })
          }
          if (options.scopes && options.scopes.length > 0) {
            inputs.push({ name: 'scopes', value: options.scopes.join(',') })
          }
          return {
            action: context.routes.link.href({ provider: providerName }),
            method: 'POST',
            inputs,
          }
        },

        getUnlinkForm(accountId?: string): OAuthFormData {
          let inputs: Array<{ name: string; value: string }> = []
          if (accountId) {
            inputs.push({ name: 'accountId', value: accountId })
          }
          return {
            action: context.routes.unlink.href({ provider: providerName }),
            method: 'POST',
            inputs,
          }
        },
      }
    }

    // Build providers object keyed by name
    let providers: Record<string, OAuthProviderHelper> = {}
    for (let providerName of Object.keys(oauthConfig.providers)) {
      providers[providerName] = createProviderHelper(providerName)
    }

    return {
      providers,

      getFlash(session: Session): OAuthFlash | null {
        return getAuthFlash(session, { feature: 'oauth' })
      },
    }
  },
}
