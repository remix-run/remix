import type { Assert, IsEqual } from './utils.ts'
import type { Join } from './join.ts'

// prettier-ignore
export type Tests = [
  // empty input/base
  Assert<IsEqual<Join<'', ''>, '/'>>,
  Assert<IsEqual<Join<'/', '/'>, '/'>>,
  Assert<IsEqual<Join<'hello', ''>, '/hello'>>,
  Assert<IsEqual<Join<'', 'hello'>, '/hello'>>,

  // input origin overrides base origin
  Assert<IsEqual<Join<'http://example.com:8080', 'https://remix.run'>, 'https://remix.run/'>>,
  Assert<IsEqual<Join<'http://example.com:8080', '://remix.run'>, '://remix.run/'>>,
  Assert<IsEqual<Join<'http://example.com', '://remix.run:8080'>, '://remix.run:8080/'>>,

  // base origin used when input has none
  Assert<IsEqual<Join<'https://remix.run', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Join<'https://remix.run/', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Join<'https://remix.run:8080', 'api'>, 'https://remix.run:8080/api'>>,
  Assert<IsEqual<Join<'https://remix.run:8080/', 'api'>, 'https://remix.run:8080/api'>>,

  // root pathname join
  Assert<IsEqual<Join<'/', 'hello'>, '/hello'>>,
  Assert<IsEqual<Join<'/', '/hello'>, '/hello'>>,

  // root input with existing pathname
  Assert<IsEqual<Join<'hello', '/'>, '/hello'>>,
  Assert<IsEqual<Join<'/hello', '/'>, '/hello'>>,

  // absolute pathname join
  Assert<IsEqual<Join<'hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'hello/', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello/', '/world'>, '/hello/world'>>,

  // relative pathname join
  Assert<IsEqual<Join<'hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'hello/', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello/', 'world'>, '/hello/world'>>,

  // optional pathname join
  Assert<IsEqual<Join<'', '(/:lang)/world'>, '(/:lang)/world'>>,
  Assert<IsEqual<Join<'/', '(/:lang)/world'>, '(/:lang)/world'>>,
  Assert<IsEqual<Join<'hello', '(/:lang)/world'>, '/hello(/:lang)/world'>>,
  Assert<IsEqual<Join<'hello/', '(/:lang)/world'>, '/hello(/:lang)/world'>>,

  // search params
  Assert<IsEqual<Join<'https://remix.run', '?q=1'>, 'https://remix.run/?q=1'>>,
  Assert<IsEqual<Join<'https://remix.run?q=1', '?q=2'>, 'https://remix.run/?q=1&q=2'>>,
]
