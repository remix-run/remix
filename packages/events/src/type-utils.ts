export type Assert<T extends true> = T
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

/** Allow any `string`, but provide type hints for `T` to power autocomplete */
export type Autocomplete<T> = T | (string & {})
