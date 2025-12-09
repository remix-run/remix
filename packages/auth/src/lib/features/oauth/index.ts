import type { Session } from '@remix-run/session'
import type {
  Feature,
  FeatureContext,
  FeatureSchema,
  FeatureRoutes,
  FeatureHandlers,
  FeatureRouteHelpers,
} from '../types.ts'
import type { AuthUser } from '../../types.ts'
import { setAuthFlash, getAuthFlash, type OAuthFlash } from '../../flash.ts'

/**
 * OAuth account linked to a user
 */
export interface OAuthAccount {
  provider: string
  providerAccountId: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
}

/**
 * Error codes returned by OAuth sign in
 */
export type OAuthSignInErrorCode =
  | 'provider_not_found'
  | 'user_not_found'
  | 'account_exists_unverified_email'
  | 'access_denied'
  | 'invalid_state'
  | 'missing_code'
  | 'provider_error'
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

/**
 * Generate a secure random state parameter for OAuth CSRF protection
 */
function generateState(): string {
  let bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// In-memory OAuth state storage (in production, use Redis or similar)
let oauthStates = new Map<string, { createdAt: number }>()

// Clean up expired states (older than 10 minutes) - only in production
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

/**
 * OAuth feature configuration
 */
export interface OAuthFeatureConfig {
  enabled: true
  providers: Record<
    string,
    {
      provider: OAuthProvider
      clientId: string
      clientSecret: string
      scopes?: string[]
    }
  >
  successURL: string
  newUserURL?: string
  errorURL: string
}

/**
 * OAuth route definitions
 * Following fetch-router idiom: { routeName: { method, pattern } }
 */
export let oauthRoutes = {
  initiate: { method: 'GET' as const, pattern: '/:provider' },
  callback: { method: 'GET' as const, pattern: '/:provider/callback' },
} satisfies FeatureRoutes

/**
 * Public provider info for UI rendering
 */
export interface OAuthProviderInfo {
  /** Provider identifier (e.g., 'github') */
  name: string
  /** Display name for UI (e.g., 'GitHub') */
  displayName: string
  /** URL to initiate OAuth sign-in */
  signInHref: string
}

/**
 * OAuth feature methods
 */
export interface OAuthFeatureMethods {
  /**
   * OAuth providers for UI rendering
   * Each provider has everything needed to render a sign-in button
   *
   * @example
   * ```tsx
   * Object.values(authClient.oauth.providers).map((provider) => (
   *   <a href={provider.signInHref}>
   *     Continue with {provider.displayName}
   *   </a>
   * ))
   * ```
   */
  providers: Record<string, OAuthProviderInfo>

  /**
   * Routes for URL generation
   */
  routes: FeatureRouteHelpers<typeof oauthRoutes>

  /**
   * Get flash message from OAuth redirect
   *
   * @example
   * ```ts
   * let flash = authClient.oauth.getFlash(session)
   * if (flash?.type === 'success') {
   *   // User signed in/up via OAuth
   * }
   * if (flash?.type === 'error') {
   *   // OAuth flow failed - check flash.code
   * }
   * ```
   */
  getFlash(session: Session): OAuthFlash | null

  /**
   * Sign in/up with OAuth provider
   * Handles sign in, sign up, and account linking automatically
   */
  signIn<TData extends Record<string, unknown> = {}>(
    options: {
      session: Session
      request: Request
      provider: string
      providerAccountId: string
      email: string
      accessToken?: string
      refreshToken?: string
      expiresIn?: number
    } & TData,
  ): Promise<
    | { type: 'sign_in'; user: AuthUser }
    | { type: 'sign_up'; user: AuthUser }
    | { type: 'account_linked'; user: AuthUser }
    | { error: OAuthSignInErrorCode }
  >
}

/**
 * OAuth authentication feature
 */
export const oauthFeature: Feature<OAuthFeatureConfig, OAuthFeatureMethods, typeof oauthRoutes> = {
  name: 'oauth',
  routes: oauthRoutes,

  isEnabled(config: any): config is OAuthFeatureConfig {
    return config?.oauth?.enabled === true
  },

  getSchema(config): FeatureSchema {
    return {
      models: [
        {
          name: 'oauthAccount',
          fields: {
            userId: { type: 'string', required: true },
            provider: { type: 'string', required: true },
            providerAccountId: { type: 'string', required: true },
            accessToken: { type: 'string', required: false },
            refreshToken: { type: 'string', required: false },
            expiresAt: { type: 'date', required: false },
          },
        },
      ],
    }
  },

  getHandlers(context: FeatureContext): FeatureHandlers<typeof oauthRoutes> {
    let { config, storage, sessionKey, authBasePath } = context
    let oauthConfig = config.oauth as OAuthFeatureConfig

    return {
      initiate({ request, session, params }) {
        let providerName = params.provider

        let providerConfig = oauthConfig.providers[providerName]
        if (!providerConfig) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'provider_not_found',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: oauthConfig.errorURL },
          })
        }

        let { provider, clientId, scopes } = providerConfig

        // Generate and store state
        let state = generateState()
        oauthStates.set(state, { createdAt: Date.now() })

        // Build redirect URI using auto-generated route helpers
        let baseUrl = context.getBaseURL(request)
        let redirectUri = `${baseUrl}${context.routes.callback.href({ provider: providerName })}`

        // Get authorization URL
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

      async callback({ request, session, params }) {
        let providerName = params.provider
        let url = new URL(request.url)
        let code = url.searchParams.get('code')
        let state = url.searchParams.get('state')
        let error = url.searchParams.get('error')
        let errorDescription = url.searchParams.get('error_description')

        let providerConfig = oauthConfig.providers[providerName]
        if (!providerConfig) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'provider_not_found',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: oauthConfig.errorURL },
          })
        }

        let { provider, clientId, clientSecret } = providerConfig

        // Handle OAuth error from provider
        if (error) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: error === 'access_denied' ? 'access_denied' : 'provider_error',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: oauthConfig.errorURL },
          })
        }

        // Validate state
        if (!state || !oauthStates.has(state)) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'invalid_state',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: oauthConfig.errorURL },
          })
        }

        // Clean up state
        oauthStates.delete(state)

        if (!code) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'missing_code',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: oauthConfig.errorURL },
          })
        }

        try {
          // Build redirect URI
          let baseUrl = context.getBaseURL(request)
          let redirectUri = `${baseUrl}${context.routes.callback.href({ provider: providerName })}`

          // Exchange code for token
          let tokenData = await provider.exchangeCodeForToken({
            clientId,
            clientSecret,
            code,
            redirectUri,
          })

          // Get user profile
          let oauthProfile = await provider.getUserProfile(tokenData.accessToken)

          // Check if OAuth account already exists
          let existingAccount = await storage.findOne<{ userId: string } & OAuthAccount>({
            model: 'oauthAccount',
            where: [
              { field: 'provider', value: providerName },
              { field: 'providerAccountId', value: oauthProfile.id },
            ],
          })

          let user: AuthUser
          let resultType: 'sign_in' | 'sign_up' | 'account_linked'

          if (existingAccount) {
            // Account exists - sign in existing user
            let existingUser = await storage.findOne<AuthUser>({
              model: 'user',
              where: [{ field: 'id', value: existingAccount.userId }],
            })
            if (!existingUser) {
              throw new Error('User not found for OAuth account')
            }

            // Update tokens if provided
            if (tokenData.accessToken) {
              await storage.update({
                model: 'oauthAccount',
                where: [
                  { field: 'userId', value: existingUser.id },
                  { field: 'provider', value: providerName },
                ],
                data: {
                  accessToken: tokenData.accessToken,
                  refreshToken: tokenData.refreshToken,
                  expiresAt: tokenData.expiresIn
                    ? new Date(Date.now() + tokenData.expiresIn * 1000)
                    : undefined,
                },
              })
            }

            // Promote emailVerified if OAuth provider verified the email
            if (
              oauthProfile.emailVerified &&
              !existingUser.emailVerified &&
              oauthProfile.email.toLowerCase().trim() === existingUser.email
            ) {
              existingUser = await storage.update<AuthUser>({
                model: 'user',
                where: [{ field: 'id', value: existingUser.id }],
                data: { emailVerified: true, updatedAt: new Date() },
              })
            }

            user = existingUser
            resultType = 'sign_in'
          } else {
            // Check if user with this email exists
            let email = oauthProfile.email.toLowerCase().trim()
            let existingUser = await storage.findOne<AuthUser>({
              model: 'user',
              where: [{ field: 'email', value: email }],
            })

            if (existingUser) {
              // Security check: don't allow linking if OAuth email is unverified
              if (!oauthProfile.emailVerified) {
                setAuthFlash(session, {
                  feature: 'oauth',
                  route: 'callback',
                  type: 'error',
                  code: 'account_exists_unverified_email',
                })
                return new Response(null, {
                  status: 302,
                  headers: { Location: oauthConfig.errorURL },
                })
              }

              // Link OAuth account to existing user
              // Promote emailVerified if OAuth provider verified the email
              if (!existingUser.emailVerified && email === existingUser.email) {
                existingUser = await storage.update<AuthUser>({
                  model: 'user',
                  where: [{ field: 'id', value: existingUser.id }],
                  data: { emailVerified: true, updatedAt: new Date() },
                })
              }

              user = existingUser
              resultType = 'account_linked'
            } else {
              // Create new user
              let now = new Date()
              user = await storage.create<AuthUser>({
                model: 'user',
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
            await storage.create({
              model: 'oauthAccount',
              data: {
                userId: user.id,
                provider: providerName,
                providerAccountId: oauthProfile.id,
                accessToken: tokenData.accessToken,
                refreshToken: tokenData.refreshToken,
                expiresAt: tokenData.expiresIn
                  ? new Date(Date.now() + tokenData.expiresIn * 1000)
                  : undefined,
              },
            })
          }

          // Set session
          session.regenerateId(true)
          session.set(sessionKey, user.id)

          // Call onUserCreated hook for new users
          if (resultType === 'sign_up' && context.onUserCreatedHook) {
            await context.onUserCreatedHook({ user, request })
          }

          // Flash success
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'success',
            code: resultType,
          })

          // Redirect to success URL
          let redirectUrl =
            resultType === 'sign_up' && oauthConfig.newUserURL
              ? oauthConfig.newUserURL
              : oauthConfig.successURL

          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl },
          })
        } catch (err) {
          setAuthFlash(session, {
            feature: 'oauth',
            route: 'callback',
            type: 'error',
            code: 'unknown_error',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: oauthConfig.errorURL },
          })
        }
      },
    }
  },

  createMethods(context): OAuthFeatureMethods {
    let { config, storage, sessionKey } = context
    let oauthConfig = config.oauth as OAuthFeatureConfig

    // Build providers with everything needed for UI rendering
    let providers: Record<string, OAuthProviderInfo> = Object.fromEntries(
      Object.entries(oauthConfig.providers).map(([name, cfg]) => [
        name,
        {
          name,
          displayName: cfg.provider.displayName,
          signInHref: context.routes.initiate.href({ provider: name }),
        },
      ]),
    )

    return {
      providers,
      // Expose auto-generated routes from context
      routes: context.routes,

      getFlash(session: Session): OAuthFlash | null {
        let flash = getAuthFlash(session, { feature: 'oauth' })
        return flash
      },

      async signIn({ session, request, provider, providerAccountId, email, ...extraData }) {
        // Check if provider exists
        if (!oauthConfig.providers[provider]) {
          return { error: 'provider_not_found' }
        }

        // Normalize email
        email = email.toLowerCase().trim()

        // Check if OAuth account already exists
        let existingAccount = await storage.findOne<{ userId: string } & OAuthAccount>({
          model: 'oauthAccount',
          where: [
            { field: 'provider', value: provider },
            { field: 'providerAccountId', value: providerAccountId },
          ],
        })

        let user: AuthUser
        let type: 'sign_in' | 'sign_up' | 'account_linked'

        if (existingAccount) {
          // Account exists - sign in existing user
          let existingUser = await storage.findOne<AuthUser>({
            model: 'user',
            where: [{ field: 'id', value: existingAccount.userId }],
          })
          if (!existingUser) {
            return { error: 'user_not_found' }
          }

          // Update tokens if provided
          if (extraData.accessToken) {
            await storage.update({
              model: 'oauthAccount',
              where: [
                { field: 'userId', value: existingUser.id },
                { field: 'provider', value: provider },
              ],
              data: {
                accessToken: extraData.accessToken as string,
                refreshToken: (extraData.refreshToken as string) || undefined,
                expiresAt: extraData.expiresIn
                  ? new Date(Date.now() + (extraData.expiresIn as number) * 1000)
                  : undefined,
              },
            })
          }

          // Promote emailVerified if OAuth provider verified the email
          if (
            extraData.emailVerified &&
            !existingUser.emailVerified &&
            email === existingUser.email
          ) {
            existingUser = await storage.update<AuthUser>({
              model: 'user',
              where: [{ field: 'id', value: existingUser.id }],
              data: { emailVerified: true, updatedAt: new Date() },
            })
          }

          user = existingUser
          type = 'sign_in'
        } else {
          // Check if user with this email exists
          let existingUser = await storage.findOne<AuthUser>({
            model: 'user',
            where: [{ field: 'email', value: email }],
          })

          if (existingUser) {
            // Security check: don't allow linking if OAuth email is unverified
            if (!extraData.emailVerified) {
              return { error: 'account_exists_unverified_email' }
            }

            // Link OAuth account to existing user
            // Promote emailVerified if OAuth provider verified the email
            if (!existingUser.emailVerified && email === existingUser.email) {
              existingUser = await storage.update<AuthUser>({
                model: 'user',
                where: [{ field: 'id', value: existingUser.id }],
                data: { emailVerified: true, updatedAt: new Date() },
              })
            }

            user = existingUser
            type = 'account_linked'
          } else {
            // Create new user
            let now = new Date()
            user = await storage.create<AuthUser>({
              model: 'user',
              data: {
                email,
                name: (extraData.name as string) || email.split('@')[0],
                image: (extraData.image as string) || undefined,
                emailVerified: (extraData.emailVerified as boolean) ?? false,
                createdAt: now,
                updatedAt: now,
                ...extraData,
              },
            })
            type = 'sign_up'
          }

          // Create OAuth account
          await storage.create({
            model: 'oauthAccount',
            data: {
              userId: user.id,
              provider,
              providerAccountId,
              accessToken: (extraData.accessToken as string) || undefined,
              refreshToken: (extraData.refreshToken as string) || undefined,
              expiresAt: extraData.expiresIn
                ? new Date(Date.now() + (extraData.expiresIn as number) * 1000)
                : undefined,
            },
          })
        }

        // Set session
        session.regenerateId(true)
        session.set(sessionKey, user.id)

        // Call onUserCreated hook for new users
        if (type === 'sign_up' && context.onUserCreatedHook) {
          await context.onUserCreatedHook({ user, request })
        }

        return { type, user }
      },
    }
  },
}
