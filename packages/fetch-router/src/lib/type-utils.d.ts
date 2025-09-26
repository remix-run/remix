export type Assert<T extends true> = T

export type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

export type Simplify<T> = { [K in keyof T]: T[K] } & {}
