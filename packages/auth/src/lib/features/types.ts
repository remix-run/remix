import type { Storage } from '../storage.ts'
import type { ModelSchema } from '../schema.ts'
import type { AuthUser } from '../types.ts'

/**
 * Base context provided to all features
 * Note: config is the full AuthClientConfig, not feature-specific
 */
export interface FeatureContext {
  config: any
  storage: Storage
  secret: string
  sessionKey: string
  /**
   * Composed hook that calls both user-defined and feature hooks
   */
  onUserCreatedHook?: (user: AuthUser) => Promise<void>
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
export interface FeatureHooks {
  /**
   * Called after a new user is created (via any signup method)
   */
  onUserCreated?: (user: AuthUser, context: FeatureContext) => void | Promise<void>
}

/**
 * Feature definition
 */
export interface Feature<TConfig = any, TMethods = any> {
  /**
   * Check if this feature is enabled based on config
   */
  isEnabled(config: any): config is TConfig

  /**
   * Get the schema requirements for this feature
   */
  getSchema(config: TConfig): FeatureSchema

  /**
   * Create the feature methods
   * Context contains the full config, storage, and sessionKey
   */
  createMethods(context: FeatureContext): TMethods

  /**
   * Optional lifecycle hooks this feature provides
   */
  hooks?: FeatureHooks
}
