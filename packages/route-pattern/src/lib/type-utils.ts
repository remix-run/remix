export type Assert<T extends true> = T

export type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Function arguments are contravariant, so unknown args must be typed as `Array<any>`
 *
 * Usage:
 *
 * ```ts
 * type UnknownFunction = (args: UnknownArgs) => unknown
 * ```
 */
export type UnknownArgs = Array<any>

/**
 * Force TS to distribute a union with `T extends ForceDistributeUnion ? ... : ...`
 * as a more explicit alias of the common `T extends any ? ... : ...` pattern.
 *
 * See: https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
 *
 * Usage:
 *
 * ```ts
 * type Stuff<T> =
 *   T extends ForceDistributive ?
 *     // Now, operate on each member of the union separately
 *     string extends T ? 'string' :
 *     T
 *   :
 *   never
 * ```
 */
export type ForceDistributive = any
