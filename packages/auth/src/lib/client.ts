import type { Session } from '@remix-run/session'
import { ArrayMatcher } from '@remix-run/route-pattern'
import type { Storage } from './storage.ts'
import type { SecondaryStorage } from './secondary-storage/types.ts'
import type { AuthSchema, ModelSchema } from './schema.ts'
import type { AuthUser, AuthAccount } from './types.ts'
import type {
  OperationsDefinition,
  OperationDefinition,
  FeatureContextBase,
} from './features/types.ts'
import {
  passwordFeature,
  oauthFeature,
  emailVerificationFeature,
  createRouteHelpers,
  type PasswordOperations,
  type PasswordHelpers,
  type OAuthOperations,
  type OAuthHelpers,
  type EmailVerificationOperations,
  type EmailVerificationHelpers,
  type OAuthProvider,
  type PasswordSignInErrorCode,
  type PasswordSignUpErrorCode,
  type PasswordChangeErrorCode,
  type PasswordGetResetTokenErrorCode,
  type PasswordResetErrorCode,
  type PasswordSetErrorCode,
  type OAuthErrorCode,
  type EmailVerificationRequestErrorCode,
  type EmailVerificationCompleteErrorCode,
} from './features/index.ts'
import { createMemorySecondaryStorage } from './secondary-storage/memory.ts'
import { checkRateLimit, findRateLimitRule, getIp, type RateLimitRule } from './rate-limit.ts'

// Re-export types
export type { AuthUser, AuthAccount } from './types.ts'

// ============================================================================
// Configuration
// ============================================================================

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
   * OAuth authentication configuration
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

  /**
   * Secondary storage for ephemeral data (rate limits, etc.)
   * @default In-memory storage
   */
  secondaryStorage?: SecondaryStorage

  /**
   * Rate limiting configuration
   * Enabled by default with sensible defaults
   */
  rateLimit?: {
    /** Enable/disable rate limiting @default true */
    enabled?: boolean
    /**
     * Headers to check for client IP address, in order of priority
     *
     * The first header with a valid value will be used. If none are found,
     * rate limiting is skipped for that request.
     *
     * ⚠️ Only include headers that your reverse proxy sets. Headers not set
     * by your proxy can be spoofed by malicious clients.
     *
     * @example ['x-forwarded-for'] - Standard proxy header
     * @example ['cf-connecting-ip'] - Cloudflare
     * @example ['x-real-ip'] - Nginx
     * @default ['x-forwarded-for']
     */
    ipAddressHeaders?: string[]
    /** Default time window in seconds @default 60 */
    window?: number
    /** Default max requests per window @default 100 */
    max?: number
    /** Override rules for specific operations */
    rules?: Record<string, RateLimitRule | false>
  }
}

// ============================================================================
// Auth Handler Types
// ============================================================================

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
 *
 * @param request - The incoming request
 * @param session - The session
 * @param formData - Optionally, the pre-parsed form data (if middleware already consumed the body)
 */
export type AuthHandler = (
  request: Request,
  session: Session,
  formData?: FormData,
) => Promise<Response | null>

// ============================================================================
// Public Feature Method Types (with rate limiting integrated into return types)
// ============================================================================

type PasswordFeatureMethods = PasswordOperations & PasswordHelpers
type OAuthFeatureMethods = OAuthOperations & OAuthHelpers
type EmailVerificationFeatureMethods = EmailVerificationOperations & EmailVerificationHelpers

// ============================================================================
// Auth Client Types
// ============================================================================

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
   * Get all accounts (authentication strategies) for a user
   *
   * @example
   * ```ts
   * let accounts = await authClient.getAccounts(userId)
   *
   * // Check for password auth
   * if (accounts.some(a => a.strategy === 'password')) { ... }
   *
   * // Get all OAuth accounts
   * let oauthAccounts = accounts.filter(a => a.strategy.startsWith('oauth.'))
   * ```
   */
  getAccounts(userId: string): Promise<AuthAccount[]>

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

// ============================================================================
// Schema Composition
// ============================================================================

function composeSchema(config: AuthClientConfig): AuthSchema {
  let modelMap = new Map<string, ModelSchema>()

  modelMap.set('authUser', {
    name: 'authUser',
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

  let features = [passwordFeature, oauthFeature, emailVerificationFeature] as const
  for (let feature of features) {
    if (feature.isEnabled(config)) {
      let featureSchema = feature.getSchema(config as any)
      if (featureSchema.models) {
        for (let model of featureSchema.models) {
          let existing = modelMap.get(model.name)
          if (existing) {
            existing.fields = { ...existing.fields, ...model.fields }
            if (model.indexes) {
              existing.indexes = [...(existing.indexes || []), ...model.indexes]
            }
          } else {
            modelMap.set(model.name, model)
          }
        }
      }
    }
  }

  return { models: Array.from(modelMap.values()) }
}

// ============================================================================
// Operation Wrapping (automatic rate limiting)
// ============================================================================

interface RateLimitContext {
  enabled: boolean
  secondaryStorage: SecondaryStorage
  ipAddressHeaders: string[]
  defaultWindow: number
  defaultMax: number
  rules: Record<string, RateLimitRule | false>
}

/**
 * Wrap operation definitions with automatic rate limiting
 * Each operation handler returns structured results, rate limiting is applied automatically
 */
function wrapOperations<TDef extends Record<string, OperationDefinition<any, any, any, any>>>(
  featureName: string,
  operationsDef: TDef,
  rateLimitContext: RateLimitContext,
): {
  [K in keyof TDef]: TDef[K] extends OperationDefinition<infer TArgs, any, any, any>
    ? (args: TArgs) => ReturnType<TDef[K]['handler']>
    : never
} {
  let wrapped = {} as any

  for (let [opName, opDef] of Object.entries(operationsDef)) {
    let operation = opName
    let { rateLimit: opRateLimit, handler } = opDef as OperationDefinition<any, any, any, any>

    wrapped[opName] = async (args: any) => {
      // Check rate limit if enabled and the operation has rate limit config
      if (rateLimitContext.enabled && opRateLimit) {
        let request = args.request as Request | undefined
        if (request) {
          // Find the applicable rule (operation-specific or from global config)
          let ruleKey = `${featureName}.${operation}`
          let rule = findRateLimitRule(
            ruleKey,
            rateLimitContext.rules,
            opRateLimit, // Use operation's default if no global rule
          )

          if (rule !== false) {
            let ip = getIp(request, rateLimitContext.ipAddressHeaders)

            // Skip rate limiting if we can't determine IP
            if (ip !== null) {
              let key = `ratelimit--${ip}--${ruleKey}`
              let result = await checkRateLimit(rateLimitContext.secondaryStorage, key, rule)

              if (result.limited) {
                return { type: 'error', code: 'rate_limited', retryAfter: result.retryAfter }
              }
            }
          }
        }
      }

      // Call the actual handler
      return handler(args)
    }
  }

  return wrapped
}

// ============================================================================
// Auth Client Factory
// ============================================================================

export function createAuthClient<const TConfig extends AuthClientConfig>(
  config: TConfig,
): AuthClient<TConfig> {
  let sessionKey = config.sessionKey ?? '@remix-run/auth:userId'
  let rawAuthBasePath = config.authBasePath ?? '/_auth'
  let authBasePath = rawAuthBasePath.endsWith('/') ? rawAuthBasePath : `${rawAuthBasePath}/`
  let baseURLConfig = config.baseURL
  let trustProxyHeaders = config.trustProxyHeaders ?? false

  let secondaryStorage = config.secondaryStorage ?? createMemorySecondaryStorage()

  // Rate limit configuration
  let rateLimitEnabled = config.rateLimit?.enabled ?? true
  let rateLimitIpAddressHeaders = config.rateLimit?.ipAddressHeaders ?? ['x-forwarded-for']
  let rateLimitDefaultWindow = config.rateLimit?.window ?? 60
  let rateLimitDefaultMax = config.rateLimit?.max ?? 100
  let rateLimitRules = config.rateLimit?.rules ?? {}

  let rateLimitContext: RateLimitContext = {
    enabled: rateLimitEnabled,
    secondaryStorage,
    ipAddressHeaders: rateLimitIpAddressHeaders,
    defaultWindow: rateLimitDefaultWindow,
    defaultMax: rateLimitDefaultMax,
    rules: rateLimitRules,
  }

  let schema = composeSchema(config)

  function getBaseURL(request?: Request): string {
    if (typeof baseURLConfig === 'function') {
      if (!request) throw new Error('baseURL is a function but no request was provided')
      return baseURLConfig(request)
    }

    if (typeof baseURLConfig === 'string') return baseURLConfig

    if (request && trustProxyHeaders) {
      let forwardedHost = request.headers.get('x-forwarded-host')
      let forwardedProto = request.headers.get('x-forwarded-proto')
      if (forwardedHost && forwardedProto) {
        return `${forwardedProto}://${forwardedHost}`
      }
    }

    if (request) return new URL(request.url).origin

    throw new Error('baseURL not configured and no request available to infer from')
  }

  function buildURL(featureName: string, routePath: string): string {
    let base = typeof baseURLConfig === 'string' ? baseURLConfig : ''
    return `${base}${authBasePath}${featureName}${routePath}`
  }

  // Base context (without checkRateLimit - it's now handled by wrapping)
  let baseContext: Omit<FeatureContextBase, 'checkRateLimit'> = {
    config,
    storage: config.storage,
    secondaryStorage,
    secret: config.secret,
    sessionKey,
    trustProxyHeaders,
    authBasePath,
    getBaseURL,
    buildURL,
    onUserCreatedHook: undefined,
  }

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

  let onUserCreatedHook = async (args: { user: AuthUser; request: Request }) => {
    let { user, request } = args

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

    if (config.hooks?.onUserCreated) {
      await config.hooks.onUserCreated(user)
    }
  }

  // Update contexts with hook
  ;(baseContext as any).onUserCreatedHook = onUserCreatedHook
  ;(passwordContext as any).onUserCreatedHook = onUserCreatedHook
  ;(oauthContext as any).onUserCreatedHook = onUserCreatedHook
  ;(emailVerificationContext as any).onUserCreatedHook = onUserCreatedHook

  // Build client with wrapped operations
  let client = {
    schema,
    authBasePath,

    ...(passwordFeature.isEnabled(config)
      ? {
          password: {
            ...wrapOperations(
              'password',
              passwordFeature.createOperations(passwordContext as any) as any,
              rateLimitContext,
            ),
            ...passwordFeature.createHelpers(passwordContext as any),
          },
        }
      : {}),

    ...(oauthFeature.isEnabled(config)
      ? (() => {
          let helpers = oauthFeature.createHelpers(oauthContext as any)
          return {
            oauth: {
              ...wrapOperations(
                'oauth',
                oauthFeature.createOperations(oauthContext as any) as any,
                rateLimitContext,
              ),
              ...helpers,
              // Spread providers at top level for direct access (e.g., authClient.oauth.github)
              ...helpers.providers,
            },
          }
        })()
      : {}),

    ...(emailVerificationFeature.isEnabled(config)
      ? {
          emailVerification: {
            ...wrapOperations(
              'emailVerification',
              emailVerificationFeature.createOperations(emailVerificationContext as any) as any,
              rateLimitContext,
            ),
            ...emailVerificationFeature.createHelpers(emailVerificationContext as any),
          },
        }
      : {}),

    async getUser(session: Session): Promise<AuthUser | null> {
      let userId = session.get(sessionKey)
      if (typeof userId !== 'string') return null

      return await config.storage.findOne<AuthUser>({
        model: 'authUser',
        where: [{ field: 'id', value: userId }],
      })
    },

    async getAccounts(userId: string): Promise<AuthAccount[]> {
      return await config.storage.findMany<AuthAccount>({
        model: 'authAccount',
        where: [{ field: 'userId', value: userId }],
      })
    },

    async signOut(session: Session): Promise<void> {
      session.destroy()
    },

    createHandler(options: AuthHandlerOptions = {}): AuthHandler {
      type RouteHandler = (ctx: {
        request: Request
        session: Session
        params: Record<string, string>
        url: URL
        formData: FormData | null
      }) => Response | Promise<Response>

      type MatchData = {
        method: string
        handler: RouteHandler
      }

      let matcher = new ArrayMatcher<MatchData>()

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

            let fullPattern = `${authBasePath}${feature.name}${routeDef.pattern}`
            matcher.add(fullPattern, {
              method: routeDef.method,
              handler: (ctx) =>
                handler({
                  request: ctx.request,
                  session: ctx.session,
                  params: ctx.params,
                  url: ctx.url,
                  formData: ctx.formData,
                }),
            })
          }
        }
      }

      return async (
        request: Request,
        session: Session,
        formData: FormData | null = null,
      ): Promise<Response | null> => {
        let url = new URL(request.url)

        if (!url.pathname.startsWith(authBasePath)) {
          return null
        }

        // Find matching route (method check happens after pattern match, like fetch-router)
        for (let match of matcher.matchAll(url)) {
          if (match.data.method !== request.method && match.data.method !== 'ANY') {
            continue
          }

          return match.data.handler({
            request,
            session,
            params: match.params,
            url: match.url,
            formData,
          })
        }

        return null
      }
    },
  }

  return client as AuthClient<TConfig>
}

// Re-export core types
export type {
  PasswordSignInErrorCode,
  PasswordSignUpErrorCode,
  PasswordChangeErrorCode,
  PasswordGetResetTokenErrorCode,
  PasswordResetErrorCode,
  PasswordSetErrorCode,
  OAuthErrorCode,
  EmailVerificationRequestErrorCode,
  EmailVerificationCompleteErrorCode,
  SecondaryStorage,
  RateLimitRule,
}
