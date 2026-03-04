/**
 * Create a request context key with an optional default value.
 *
 * @param defaultValue The default value for the context key
 * @returns The new context key
 */
export function createContextKey<value>(defaultValue?: value): ContextKey<value> {
  return { defaultValue }
}

/**
 * A type-safe key for storing and retrieving values from `RequestContext`.
 */
export interface ContextKey<value> {
  /**
   * The default value for this key if no value has been set.
   */
  defaultValue?: value
}

export type ContextValue<key> =
  key extends ContextKey<infer value> ? value :
  key extends abstract new (...args: any[]) => infer instance ? instance :
  never
