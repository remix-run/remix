import type { Session } from '@remix-run/session'
import type { Storage } from './storage.ts'
import type { AuthSchema, ModelSchema } from './schema.ts'
import type { AuthUser } from './types.ts'
import {
  passwordFeature,
  oauthFeature,
  emailVerificationFeature,
  createRouteHelpers,
  type PasswordFeatureMethods,
  type OAuthFeatureMethods,
  type EmailVerificationFeatureMethods,
  type OAuthProvider,
  type OAuthAccount,
  type PasswordSignInErrorCode,
  type PasswordSignUpErrorCode,
  type PasswordChangeErrorCode,
  type PasswordGetResetTokenErrorCode,
  type PasswordResetCompleteErrorCode,
  type OAuthSignInErrorCode,
  type EmailVerificationRequestErrorCode,
  type EmailVerificationCompleteErrorCode,
  type FeatureContextBase,
} from './features/index.ts'

export interface AuthClientConfig {
  /**
   * Secret key used for cryptographic operations (encryption, signing, etc.)
   * This should be a long, random string.
   * Generate one with: `openssl rand -base64 32`
   *
   * ⚠️ Keep this secret! Never commit it to version control.
   */
  secret: string

  /**
   * Base URL for the application (origin only, e.g., 'http://localhost:44100')
   * Used for generating full URLs in emails, OAuth redirects, etc.
   *
   * Can be:
   * - A string: `'https://myapp.com'`
   * - A function: `(request) => new URL(request.url).origin`
   * - Omitted: Will be inferred from the request when available
   *
   * @example
   * ```ts
   * // Static
   * baseURL: 'https://myapp.com'
   *
   * // Dynamic (e.g., multi-tenant)
   * baseURL: (request) => new URL(request.url).origin
   * ```
   */
  baseURL?: string | ((request: Request) => string)

  /**
   * Trust proxy headers (`x-forwarded-host`, `x-forwarded-proto`) when inferring the base URL.
   *
   * Enable this when running behind a reverse proxy (Nginx, Cloudflare, AWS ALB, etc.)
   * that sets these headers. When enabled, the base URL will be inferred from the
   * proxy headers instead of the request URL.
   *
   * ⚠️ Only enable this if you trust your proxy. These headers can be spoofed by
   * malicious clients if your app is directly exposed to the internet.
   *
   * @default false
   */
  trustProxyHeaders?: boolean

  /**
   * Base path for auth API routes
   * @default '/_auth'
   *
   * Routes will be mounted at this path:
   * - GET {authBasePath}/oauth/:provider - Initiate OAuth flow
   * - GET {authBasePath}/oauth/:provider/callback - OAuth callback
   * - GET {authBasePath}/email-verification/verify/:token - Email verification
   */
  authBasePath?: string

  /**
   * Session key for storing the user ID.
   * @default '@remix-run/auth:userId'
   */
  sessionKey?: string

  /**
   * Lifecycle hooks for auth events
   */
  hooks?: {
    /**
     * Called after a new user is created (via any signup method)
     * Useful for sending welcome emails, analytics, etc.
     */
    onUserCreated?: (user: AuthUser) => void | Promise<void>
  }

  /**
   * Password authentication configuration
   */
  password?: {
    /**
     * Enable password authentication
     * When true, password signin/signup methods become available
     */
    enabled: true

    /**
     * Custom password hashing algorithm
     * @default 'pbkdf2'
     */
    algorithm?:
      | 'pbkdf2'
      | {
          hash: (password: string) => Promise<string>
          verify: (password: string, hash: string) => Promise<boolean>
        }
  }

  /**
   * OAuth provider configurations
   */
  oauth?: {
    /**
     * Enable OAuth authentication
     * When true, OAuth signin methods become available
     */
    enabled: true

    /**
     * OAuth provider configurations
     */
    providers: Record<
      string,
      {
        provider: OAuthProvider
        clientId: string
        clientSecret: string
        scopes?: string[]
      }
    >

    /**
     * URL to redirect to after successful authentication
     */
    successURL: string

    /**
     * URL to redirect to after a new user signs up via OAuth
     * @default successURL
     */
    newUserURL?: string

    /**
     * URL to redirect to if an error occurs during authentication
     */
    errorURL: string
  }

  /**
   * Email verification configuration
   */
  emailVerification?: {
    /**
     * Enable email verification
     * When true, email verification methods become available
     */
    enabled: true

    /**
     * Callback to send verification email
     * @param data.user - The user to send verification email to
     * @param data.token - JWT token for verification
     * @param data.href - Full verification URL
     * @param data.isNewUser - Whether this is a new user signup (for welcome messages)
     * @param data.request - The original request (for deriving URLs, headers, etc.)
     */
    sendVerification(data: {
      user: AuthUser
      token: string
      href: string
      isNewUser: boolean
      request: Request
    }): void | Promise<void>

    /**
     * Optional callback after successful email verification
     * Useful for sending "welcome, you're verified!" emails or analytics
     */
    onVerified?(user: AuthUser): void | Promise<void>

    /**
     * Token expiration time in seconds
     * @default 3600 (1 hour)
     */
    expiresIn?: number

    /**
     * URL to redirect to after successful verification
     * @default '/'
     */
    successURL?: string

    /**
     * URL to redirect to if verification fails
     * @default '/'
     */
    errorURL?: string
  }

  /**
   * Storage adapter implementing the generic Storage interface
   *
   * @example Using memory storage adapter
   * ```ts
   * import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
   *
   * storage: createMemoryStorageAdapter()
   * ```
   *
   * @example Custom storage adapter
   * ```ts
   * storage: {
   *   async findOne({ model, where }) { ... },
   *   async create({ model, data }) { ... },
   *   // ... etc
   * }
   * ```
   */
  storage: Storage
}

/**
 * Options for creating an auth API handler
 */
export interface AuthHandlerOptions {
  /**
   * @deprecated Use `authBasePath` in the config instead
   */
  basePath?: string
}

/**
 * Auth API handler function
 * Returns a Response for matched routes, or null if no route matches
 */
export type AuthHandler = (request: Request, session: Session) => Promise<Response | null>

/**
 * Base auth client interface (always present)
 */
export interface AuthClientBase<TUser extends AuthUser = AuthUser> {
  /**
   * Schema definition for the auth models
   *
   * This schema describes the data requirements based on your configuration.
   * You can use this to generate ORM schemas, SQL migrations, or for documentation.
   */
  schema: AuthSchema

  /**
   * Base path for auth API routes
   */
  authBasePath: string

  /**
   * Get the current authenticated user from session
   */
  getUser(session: Session): Promise<TUser | null>

  /**
   * Sign out (destroy session)
   */
  signOut(session: Session): Promise<void>

  /**
   * Create an API handler for auth routes
   *
   * This returns a function that handles all auth-related HTTP routes
   * (OAuth flows, email verification, etc.) as a single handler.
   *
   * @example
   * ```ts
   * let authApi = authClient.createHandler({ basePath: '/api/auth' })
   *
   * // In fetch-router:
   * router.route('ANY', '/api/auth/*', ({ request, session }) => authApi(request, session))
   *
   * // Or in vanilla fetch:
   * let response = await authApi(request, session)
   * if (response) return response
   * ```
   */
  createHandler(options?: AuthHandlerOptions): AuthHandler
}

/**
 * Full auth client type - conditionally includes Password, OAuth, and EmailVerification based on config
 * Feature methods come from their respective feature files
 */
export type AuthClient<TConfig extends AuthClientConfig = AuthClientConfig> =
  AuthClientBase<AuthUser> &
    (TConfig['password'] extends { enabled: true } ? { password: PasswordFeatureMethods } : {}) &
    (TConfig['oauth'] extends { enabled: true } ? { oauth: OAuthFeatureMethods } : {}) &
    (TConfig['emailVerification'] extends { enabled: true }
      ? { emailVerification: EmailVerificationFeatureMethods }
      : {})

/**
 * Compose schema from enabled features
 * Supports both adding new models and extending existing models with additional fields
 */
function composeSchema(config: AuthClientConfig): AuthSchema {
  let modelMap = new Map<string, ModelSchema>()

  // Start with base user model
  modelMap.set('user', {
    name: 'user',
    fields: {
      id: { type: 'string', required: true },
      email: { type: 'string', required: true },
      name: { type: 'string', required: true },
      image: { type: 'string', required: false },
      emailVerified: { type: 'boolean', required: true },
      createdAt: { type: 'date', required: true },
      updatedAt: { type: 'date', required: true },
    },
  })

  // Merge in feature schemas
  let features = [passwordFeature, oauthFeature, emailVerificationFeature] as const
  for (let feature of features) {
    if (feature.isEnabled(config)) {
      let featureSchema = feature.getSchema(config as any)
      if (featureSchema.models) {
        for (let model of featureSchema.models) {
          let existing = modelMap.get(model.name)
          if (existing) {
            // Merge fields into existing model
            existing.fields = { ...existing.fields, ...model.fields }
            // Merge indexes
            if (model.indexes) {
              existing.indexes = [...(existing.indexes || []), ...model.indexes]
            }
          } else {
            // Add new model
            modelMap.set(model.name, model)
          }
        }
      }
    }
  }

  return { models: Array.from(modelMap.values()) }
}

export function createAuthClient<const TConfig extends AuthClientConfig>(
  config: TConfig,
): AuthClient<TConfig> {
  let sessionKey = config.sessionKey ?? '@remix-run/auth:userId'
  // Normalize authBasePath to always end with trailing slash for proper prefix matching
  let rawAuthBasePath = config.authBasePath ?? '/_auth'
  let authBasePath = rawAuthBasePath.endsWith('/') ? rawAuthBasePath : `${rawAuthBasePath}/`
  let baseURLConfig = config.baseURL
  let trustProxyHeaders = config.trustProxyHeaders ?? false

  // Compose schema from enabled features
  let schema = composeSchema(config)

  // Helper to get base URL - supports static string, function, or inference from request
  function getBaseURL(request?: Request): string {
    // 1. Explicit function config
    if (typeof baseURLConfig === 'function') {
      if (!request) {
        throw new Error('baseURL is a function but no request was provided')
      }
      return baseURLConfig(request)
    }

    // 2. Explicit string config
    if (typeof baseURLConfig === 'string') {
      return baseURLConfig
    }

    // 3. Infer from proxy headers (if trusted)
    if (request && trustProxyHeaders) {
      let forwardedHost = request.headers.get('x-forwarded-host')
      let forwardedProto = request.headers.get('x-forwarded-proto')
      if (forwardedHost && forwardedProto) {
        return `${forwardedProto}://${forwardedHost}`
      }
    }

    // 4. Infer from request URL
    if (request) {
      return new URL(request.url).origin
    }

    throw new Error('baseURL not configured and no request available to infer from')
  }

  // Helper to build full URLs for feature routes
  function buildURL(featureName: string, routePath: string): string {
    // This is used without request context, so requires static baseURL
    let base = typeof baseURLConfig === 'string' ? baseURLConfig : ''
    return `${base}${authBasePath}${featureName}${routePath}`
  }

  // Base context shared by all features (without routes)
  let baseContext: FeatureContextBase = {
    config,
    storage: config.storage,
    secret: config.secret,
    sessionKey,
    authBasePath,
    getBaseURL,
    buildURL,
    onUserCreatedHook: undefined,
  }

  // Create feature-specific contexts with auto-generated route helpers
  let passwordContext = {
    ...baseContext,
    routes: createRouteHelpers(
      passwordFeature.name,
      passwordFeature.routes,
      authBasePath,
      getBaseURL,
    ),
  }
  let oauthContext = {
    ...baseContext,
    routes: createRouteHelpers(oauthFeature.name, oauthFeature.routes, authBasePath, getBaseURL),
  }
  let emailVerificationContext = {
    ...baseContext,
    routes: createRouteHelpers(
      emailVerificationFeature.name,
      emailVerificationFeature.routes,
      authBasePath,
      getBaseURL,
    ),
  }

  // Compose onUserCreated hook from features and user config
  // Request is required so hooks can access headers, derive URLs, etc.
  let onUserCreatedHook = async (args: { user: AuthUser; request: Request }) => {
    let { user, request } = args

    // Call feature hooks first (e.g., email verification)
    if (passwordFeature.isEnabled(config) && passwordFeature.hooks?.onUserCreated) {
      await passwordFeature.hooks.onUserCreated({ user, context: passwordContext as any, request })
    }
    if (oauthFeature.isEnabled(config) && oauthFeature.hooks?.onUserCreated) {
      await oauthFeature.hooks.onUserCreated({ user, context: oauthContext as any, request })
    }
    if (
      emailVerificationFeature.isEnabled(config) &&
      emailVerificationFeature.hooks?.onUserCreated
    ) {
      await emailVerificationFeature.hooks.onUserCreated({
        user,
        context: emailVerificationContext as any,
        request,
      })
    }

    // Then call user-defined hook
    if (config.hooks?.onUserCreated) {
      await config.hooks.onUserCreated(user)
    }
  }

  // Update all contexts with the composed hook
  baseContext.onUserCreatedHook = onUserCreatedHook
  passwordContext.onUserCreatedHook = onUserCreatedHook
  oauthContext.onUserCreatedHook = onUserCreatedHook
  emailVerificationContext.onUserCreatedHook = onUserCreatedHook

  // Build client by composing features
  let client = {
    schema,
    authBasePath,

    ...(passwordFeature.isEnabled(config)
      ? {
          password: passwordFeature.createMethods(passwordContext as any),
        }
      : {}),

    ...(oauthFeature.isEnabled(config)
      ? {
          oauth: oauthFeature.createMethods(oauthContext as any),
        }
      : {}),

    ...(emailVerificationFeature.isEnabled(config)
      ? {
          emailVerification: emailVerificationFeature.createMethods(
            emailVerificationContext as any,
          ),
        }
      : {}),

    async getUser(session: Session): Promise<AuthUser | null> {
      let userId = session.get(sessionKey)
      if (typeof userId !== 'string') {
        return null
      }

      return await config.storage.findOne<AuthUser>({
        model: 'user',
        where: [{ field: 'id', value: userId }],
      })
    },

    async signOut(session: Session): Promise<void> {
      session.destroy()
    },

    createHandler(options: AuthHandlerOptions = {}): AuthHandler {
      // Note: basePath option is now ignored - use config.authBasePath instead
      // This is for backwards compatibility but the config value takes precedence

      // Collect all routes from enabled features
      type RouteEntry = {
        method: string
        pattern: string
        handler: (ctx: {
          request: Request
          session: Session
          params: Record<string, string>
          url: URL
        }) => Response | Promise<Response>
      }
      let routes: RouteEntry[] = []

      // Collect handlers from each enabled feature
      let allFeatures = [
        { feature: passwordFeature, context: passwordContext },
        { feature: oauthFeature, context: oauthContext },
        { feature: emailVerificationFeature, context: emailVerificationContext },
      ] as const

      for (let { feature, context } of allFeatures) {
        if (feature.isEnabled(config) && feature.routes && feature.getHandlers) {
          let featureRoutes = feature.routes
          let featureHandlers = feature.getHandlers(context as any)

          for (let [routeName, routeDef] of Object.entries(featureRoutes)) {
            let handler = (featureHandlers as Record<string, any>)[routeName]
            if (!handler) continue

            // Mount route at: authBasePath/featureName/routePattern
            let fullPattern = `${authBasePath}${feature.name}${routeDef.pattern}`
            routes.push({
              method: routeDef.method,
              pattern: fullPattern,
              handler: (ctx) =>
                handler({
                  request: ctx.request,
                  session: ctx.session,
                  params: ctx.params,
                  url: ctx.url,
                }),
            })
          }
        }
      }

      // Simple pattern matching helper
      function matchRoute(
        method: string,
        pathname: string,
      ): { handler: RouteEntry['handler']; params: Record<string, string> } | null {
        for (let route of routes) {
          if (route.method !== method && route.method !== 'ANY') continue

          // Convert pattern to regex for matching
          let paramNames: string[] = []
          let regexPattern = route.pattern.replace(/:([^/]+)/g, (_, name) => {
            paramNames.push(name)
            return '([^/]+)'
          })

          let regex = new RegExp(`^${regexPattern}$`)
          let match = pathname.match(regex)

          if (match) {
            let params: Record<string, string> = {}
            paramNames.forEach((name, i) => {
              params[name] = match![i + 1]
            })
            return { handler: route.handler, params }
          }
        }
        return null
      }

      // Return handler function
      return async (request: Request, session: Session): Promise<Response | null> => {
        let url = new URL(request.url)

        // Quick check if path could match any auth routes
        if (!url.pathname.startsWith(authBasePath)) {
          return null
        }

        // Match route
        let matched = matchRoute(request.method, url.pathname)
        if (!matched) {
          return null
        }

        return matched.handler({ request, session, params: matched.params, url })
      }
    },
  }

  return client as AuthClient<TConfig>
}

// Re-export core types for convenience
export type {
  AuthUser,
  OAuthAccount,
  PasswordSignInErrorCode,
  PasswordSignUpErrorCode,
  PasswordChangeErrorCode,
  PasswordGetResetTokenErrorCode,
  PasswordResetCompleteErrorCode,
  OAuthSignInErrorCode,
}
