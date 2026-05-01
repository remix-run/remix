export type Assert<T extends true> = T

export type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Forces TypeScript to distribute a conditional type over a union by
 * substituting `T extends ForceDistributive ? ... : ...` for the more cryptic
 * `T extends any ? ... : ...` pattern.
 */
export type ForceDistributive = any
