export type Assert<T extends true> = T

export type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Forces TypeScript to distribute a conditional type over a union by
 * substituting `T extends ForceDistributive ? ... : ...` for a bare
 * `T extends unknown ? ... : ...` pattern.
 */
export type ForceDistributive = unknown

/** Distributive utility for creating mutable versions of readonly union types. */
export type Mutable<T> = T extends ForceDistributive ? { -readonly [K in keyof T]: T[K] } : never
