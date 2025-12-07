import type { Session } from '@remix-run/session'
import type { Feature, FeatureContext, FeatureSchema } from '../types.ts'
import type { AuthUser } from '../../types.ts'

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
export type OAuthSignInErrorCode = 'provider_not_found' | 'user_not_found'

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
  baseURL: string | ((request: Request) => string)
  successURL: string
  newUserURL?: string
  errorURL: string
}

/**
 * OAuth flow handlers
 */
export interface OAuthFlow {
  initiate(request: Request, session: Session): Response
  callback(request: Request, session: Session): Promise<Response>
}

/**
 * OAuth feature methods
 */
export interface OAuthFeatureMethods {
  /**
   * OAuth provider configurations (for UI rendering)
   */
  providers: Record<
    string,
    {
      provider: OAuthProvider
      clientId: string
      scopes?: string[]
    }
  >

  /**
   * OAuth flow handlers (for routing)
   */
  flows: Record<string, OAuthFlow>

  /**
   * Sign in/up with OAuth provider
   * Handles sign in, sign up, and account linking automatically
   */
  signIn<TData extends Record<string, unknown> = {}>(
    options: {
      session: Session
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
export const oauthFeature: Feature<OAuthFeatureConfig, OAuthFeatureMethods> = {
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

  createMethods(context: FeatureContext): OAuthFeatureMethods {
    let { config, storage, sessionKey } = context
    let oauthConfig = config.oauth as OAuthFeatureConfig

    // Prepare providers for public access (without secrets)
    let publicProviders = Object.fromEntries(
      Object.entries(oauthConfig.providers).map(([name, cfg]) => [
        name,
        {
          provider: cfg.provider,
          clientId: cfg.clientId,
          scopes: cfg.scopes,
        },
      ]),
    )

    // Create OAuth flow handlers
    let flows: Record<string, OAuthFlow> = {}

    for (let [providerName, providerConfig] of Object.entries(oauthConfig.providers)) {
      let { provider, clientId, clientSecret, scopes } = providerConfig

      flows[providerName] = {
        initiate(request: Request, session: Session): Response {
          // Generate and store state
          let state = generateState()
          oauthStates.set(state, { createdAt: Date.now() })

          // Build redirect URI
          let baseUrl =
            typeof oauthConfig.baseURL === 'function'
              ? oauthConfig.baseURL(request)
              : oauthConfig.baseURL
          let redirectUri = `${baseUrl}/auth/${providerName}/callback`

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

        async callback(request: Request, session: Session): Promise<Response> {
          let url = new URL(request.url)
          let code = url.searchParams.get('code')
          let state = url.searchParams.get('state')
          let error = url.searchParams.get('error')
          let errorDescription = url.searchParams.get('error_description')

          // Handle OAuth error from provider
          if (error) {
            session.flash('error', errorDescription || `OAuth error: ${error}`)
            return new Response(null, {
              status: 302,
              headers: { Location: oauthConfig.errorURL },
            })
          }

          // Validate state
          if (!state || !oauthStates.has(state)) {
            session.flash('error', 'Invalid or expired OAuth state. Please try again.')
            return new Response(null, {
              status: 302,
              headers: { Location: oauthConfig.errorURL },
            })
          }

          // Clean up state
          oauthStates.delete(state)

          if (!code) {
            session.flash('error', 'Authorization code not received from OAuth provider.')
            return new Response(null, {
              status: 302,
              headers: { Location: oauthConfig.errorURL },
            })
          }

          try {
            // Build redirect URI
            let baseUrl =
              typeof oauthConfig.baseURL === 'function'
                ? oauthConfig.baseURL(request)
                : oauthConfig.baseURL
            let redirectUri = `${baseUrl}/auth/${providerName}/callback`

            // Exchange code for token
            let tokenData = await provider.exchangeCodeForToken({
              clientId,
              clientSecret,
              code,
              redirectUri,
            })

            // Get user profile
            let profile = await provider.getUserProfile(tokenData.accessToken)

            // Check if OAuth account already exists
            let existingAccount = await storage.findOne<{ userId: string } & OAuthAccount>({
              model: 'oauthAccount',
              where: [
                { field: 'provider', value: providerName },
                { field: 'providerAccountId', value: profile.id },
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

              user = existingUser
              resultType = 'sign_in'
            } else {
              // Check if user with this email exists
              let email = profile.email.toLowerCase().trim()
              let existingUser = await storage.findOne<AuthUser>({
                model: 'user',
                where: [{ field: 'email', value: email }],
              })

              if (existingUser) {
                // Link OAuth account to existing user
                user = existingUser
                resultType = 'account_linked'
              } else {
                // Create new user
                let now = new Date()
                user = await storage.create<AuthUser>({
                  model: 'user',
                  data: {
                    email,
                    name: profile.name || profile.email.split('@')[0],
                    image: profile.avatarUrl,
                    emailVerified: false, // OAuth users can verify email later if needed
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
                  providerAccountId: profile.id,
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

            // Call onUserCreated hook for new users (will be composed with feature hooks by client)
            if (resultType === 'sign_up' && context.onUserCreatedHook) {
              await context.onUserCreatedHook(user)
            }

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
            let errorMessage =
              err instanceof Error
                ? err.message
                : 'An error occurred during OAuth sign in. Please try again.'
            session.flash('error', errorMessage)
            return new Response(null, {
              status: 302,
              headers: { Location: oauthConfig.errorURL },
            })
          }
        },
      }
    }

    return {
      providers: publicProviders,
      flows,

      async signIn({ session, provider, providerAccountId, email, ...extraData }) {
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

          user = existingUser
          type = 'sign_in'
        } else {
          // Check if user with this email exists
          let existingUser = await storage.findOne<AuthUser>({
            model: 'user',
            where: [{ field: 'email', value: email }],
          })

          if (existingUser) {
            // Link OAuth account to existing user
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
                emailVerified: false, // OAuth users can verify email later if needed
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

        // Call onUserCreated hook for new users (will be composed with feature hooks by client)
        if (type === 'sign_up' && context.onUserCreatedHook) {
          await context.onUserCreatedHook(user)
        }

        return { type, user }
      },
    }
  },
}
