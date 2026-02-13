export type Assert<condition extends true> = condition

export type IsEqual<left, right> =
  (<input>() => input extends left ? 1 : 2) extends <input>() => input extends right ? 1 : 2
    ? true
    : false
