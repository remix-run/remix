import type { Session } from '@remix-run/session'
import type { Storage } from '../storage.ts'

/**
 * HTTP request methods
 */
export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'
import type { SecondaryStorage } from '../secondary-storage/types.ts'
import type { ModelSchema } from '../schema.ts'
import type { AuthUser } from '../types.ts'

// ============================================================================
// Structured Result Types
// ============================================================================

/**
 * Success result from an operation
 */
export interface SuccessResult<TCode extends string, TData extends object = {}> {
  type: 'success'
  code: TCode
  data: TData
}

/**
 * Error result from an operation
 */
export interface ErrorResult<TCode extends string> {
  type: 'error'
  code: TCode | 'rate_limited'
  retryAfter?: number
}

/**
 * Combined result type for operations
 */
export type OperationResult<
  TSuccessCode extends string,
  TSuccessData extends object,
  TErrorCode extends string,
> = SuccessResult<TSuccessCode, TSuccessData> | ErrorResult<TErrorCode>

// ============================================================================
// Operation Definition Types
// ============================================================================

/**
 * Rate limit configuration for an operation
 */
export interface OperationRateLimit {
  /** Time window in seconds */
  window: number
  /** Maximum requests allowed in the window */
  max: number
}

/**
 * Base operation definition with rate limit metadata
 */
export interface OperationDefinition<
  TArgs extends object,
  TSuccessType extends string,
  TSuccessData extends object,
  TErrorType extends string,
> {
  /** Rate limit configuration (optional - if not set, uses global defaults) */
  rateLimit?: OperationRateLimit
  /** The operation handler */
  handler: (args: TArgs) => Promise<OperationResult<TSuccessType, TSuccessData, TErrorType>>
}

/**
 * Operations definition object - maps operation names to their definitions
 */
export type OperationsDefinition = {
  [key: string]: OperationDefinition<any, any, any, any>
}

/**
 * Route definition using fetch-router idiom
 */
export interface FeatureRouteDef {
  method: RequestMethod | 'ANY'
  pattern: string
}

/**
 * Routes object - maps route names to route definitions
 * Following fetch-router idiom: { routeName: { method, pattern } }
 */
export type FeatureRoutes = Record<string, FeatureRouteDef>

/**
 * Auto-generated route helper for a single route
 */
export interface FeatureRouteHelper {
  /** Returns the path (e.g., "/_auth/email-verification/verify/abc123") */
  href(params?: Record<string, string>): string
  /** Returns the full URL (e.g., "http://localhost:44100/_auth/email-verification/verify/abc123") */
  url(params?: Record<string, string>, request?: Request): string
}

/**
 * Auto-generated route helpers for all routes in a feature
 */
export type FeatureRouteHelpers<TRoutes extends FeatureRoutes = FeatureRoutes> = {
  [K in keyof TRoutes]: FeatureRouteHelper
}

/**
 * Base context provided to all features (without routes)
 */
export interface FeatureContextBase {
  config: any
  storage: Storage
  secondaryStorage: SecondaryStorage
  secret: string
  sessionKey: string
  trustProxyHeaders: boolean
  /**
   * Base path where auth routes are mounted (e.g., '/_auth/')
   * Always ends with trailing slash
   */
  authBasePath: string
  /**
   * Get the base URL for the application.
   * If a request is provided, can infer from request.url.
   * Falls back to configured baseURL or throws if neither available.
   */
  getBaseURL: (request?: Request) => string
  /**
   * Composed hook that calls both user-defined and feature hooks
   */
  onUserCreatedHook?: (args: { user: AuthUser; request: Request }) => Promise<void>
  /**
   * Build a URL for a feature path (for non-route URLs like password reset forms)
   * Prefer using context.routes for actual API routes
   */
  buildURL: (featureName: string, routePath: string) => string
}

/**
 * Feature context with auto-generated route helpers
 */
export interface FeatureContext<TRoutes extends FeatureRoutes = FeatureRoutes>
  extends FeatureContextBase {
  /**
   * Auto-generated route helpers for this feature
   * Each route has href() and url() methods
   */
  routes: FeatureRouteHelpers<TRoutes>
}

/**
 * Schema contribution from a feature
 */
export interface FeatureSchema {
  models?: ModelSchema[]
}

/**
 * Lifecycle hooks that features can register
 */
export interface FeatureHooks<TRoutes extends FeatureRoutes = FeatureRoutes> {
  /**
   * Called after a new user is created (via any signup method)
   * @param args.user - The newly created user
   * @param args.context - Feature context
   * @param args.request - The request (for deriving URLs, headers, etc.)
   */
  onUserCreated?: (args: {
    user: AuthUser
    context: FeatureContext<TRoutes>
    request: Request
  }) => void | Promise<void>
}

/**
 * Handler context passed to feature route handlers
 */
export interface FeatureHandlerContext<TParams = Record<string, string>> {
  request: Request
  session: Session
  params: TParams
  url: URL
  formData: FormData | null
}

/**
 * A route handler function
 */
export type FeatureHandler<TParams = Record<string, string>> = (
  context: FeatureHandlerContext<TParams>,
) => Response | Promise<Response>

/**
 * Handlers object - maps route names to handler functions
 * Keys must match the routes object
 */
export type FeatureHandlers<TRoutes extends FeatureRoutes = FeatureRoutes> = {
  [K in keyof TRoutes]: FeatureHandler<Record<string, string>>
}

/**
 * Feature definition with operations/helpers split
 *
 * Operations: Rate-limitable methods with declarative config
 * Helpers: Non-rate-limitable utilities (providers, getFlash, etc.)
 */
export interface Feature<
  TConfig = any,
  TOperationsDef = any,
  THelpers = any,
  TRoutes extends FeatureRoutes = FeatureRoutes,
> {
  /**
   * Feature name, used as route prefix (e.g., 'oauth', 'email-verification')
   */
  name: string

  /**
   * Route definitions for this feature
   */
  routes: TRoutes

  /**
   * Check if this feature is enabled based on config
   */
  isEnabled(config: any): config is TConfig

  /**
   * Get the schema requirements for this feature
   */
  getSchema(config: TConfig): FeatureSchema

  /**
   * Create operation definitions with declarative rate limit config
   * The framework wraps these to apply rate limiting automatically
   */
  createOperations(context: FeatureContext<TRoutes>): TOperationsDef

  /**
   * Create non-rate-limitable helpers (utilities, data access, etc.)
   */
  createHelpers(context: FeatureContext<TRoutes>): THelpers

  /**
   * Get route handlers for this feature
   * Keys must match the routes object
   */
  getHandlers?(context: FeatureContext<TRoutes>): FeatureHandlers<TRoutes>

  /**
   * Optional lifecycle hooks this feature provides
   */
  hooks?: FeatureHooks<TRoutes>
}

/**
 * Create route helpers for a feature from its route definitions
 */
export function createRouteHelpers<TRoutes extends FeatureRoutes>(
  featureName: string,
  routes: TRoutes,
  authBasePath: string,
  getBaseURL: (request?: Request) => string,
): FeatureRouteHelpers<TRoutes> {
  let helpers = {} as FeatureRouteHelpers<TRoutes>

  for (let routeName of Object.keys(routes) as (keyof TRoutes)[]) {
    let routeDef = routes[routeName]

    helpers[routeName] = {
      href(params?: Record<string, string>): string {
        let path = routeDef.pattern
        if (params) {
          for (let [key, value] of Object.entries(params)) {
            path = path.replace(`:${key}`, value)
          }
        }
        return `${authBasePath}${featureName}${path}`
      },
      url(params?: Record<string, string>, request?: Request): string {
        return `${getBaseURL(request)}${this.href(params)}`
      },
    }
  }

  return helpers
}
