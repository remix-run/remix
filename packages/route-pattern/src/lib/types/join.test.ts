import type { Assert, IsEqual } from './utils.ts'
import type { JoinPatterns } from './join.ts'

// prettier-ignore
export type Tests = [
  // empty input/base
  Assert<IsEqual<JoinPatterns<'', ''>, '/'>>,
  Assert<IsEqual<JoinPatterns<'/', '/'>, '/'>>,
  Assert<IsEqual<JoinPatterns<'hello', ''>, '/hello'>>,
  Assert<IsEqual<JoinPatterns<'', 'hello'>, '/hello'>>,

  // input origin overrides base origin
  Assert<IsEqual<JoinPatterns<'http://example.com:8080', 'https://remix.run'>, 'https://remix.run:8080/'>>,
  Assert<IsEqual<JoinPatterns<'http://example.com:8080', '://remix.run'>, 'http://remix.run:8080/'>>,
  Assert<IsEqual<JoinPatterns<'http://example.com', '://remix.run:8080'>, 'http://remix.run:8080/'>>,
  Assert<IsEqual<JoinPatterns<'https://example.com:8080/base', 'http:///next'>, 'http://example.com:8080/base/next'>>,
  Assert<IsEqual<JoinPatterns<'/base', ':proto://example.com/path'>, never>>,

  // base origin used when input has none
  Assert<IsEqual<JoinPatterns<'https://remix.run', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<JoinPatterns<'https://remix.run/', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<JoinPatterns<'https://remix.run:8080', 'api'>, 'https://remix.run:8080/api'>>,
  Assert<IsEqual<JoinPatterns<'https://remix.run:8080/', 'api'>, 'https://remix.run:8080/api'>>,

  // root pathname join
  Assert<IsEqual<JoinPatterns<'/', 'hello'>, '/hello'>>,
  Assert<IsEqual<JoinPatterns<'/', '/hello'>, '/hello'>>,

  // root input with existing pathname
  Assert<IsEqual<JoinPatterns<'hello', '/'>, '/hello'>>,
  Assert<IsEqual<JoinPatterns<'/hello', '/'>, '/hello'>>,

  // absolute pathname join
  Assert<IsEqual<JoinPatterns<'hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<JoinPatterns<'/hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<JoinPatterns<'hello/', '/world'>, '/hello/world'>>,
  Assert<IsEqual<JoinPatterns<'/hello/', '/world'>, '/hello/world'>>,

  // relative pathname join
  Assert<IsEqual<JoinPatterns<'hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<JoinPatterns<'/hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<JoinPatterns<'hello/', 'world'>, '/hello/world'>>,
  Assert<IsEqual<JoinPatterns<'/hello/', 'world'>, '/hello/world'>>,

  // optional pathname join
  Assert<IsEqual<JoinPatterns<'', '(/:lang)/world'>, '(/:lang)/world'>>,
  Assert<IsEqual<JoinPatterns<'/', '(/:lang)/world'>, '(/:lang)/world'>>,
  Assert<IsEqual<JoinPatterns<'hello', '(/:lang)/world'>, '/hello(/:lang)/world'>>,
  Assert<IsEqual<JoinPatterns<'hello/', '(/:lang)/world'>, '/hello(/:lang)/world'>>,

  // search params
  Assert<IsEqual<JoinPatterns<'https://remix.run', '?q=1'>, 'https://remix.run/?q=1'>>,
  Assert<IsEqual<JoinPatterns<'https://remix.run?q=1', '?q=2'>, 'https://remix.run/?q=1&q=2'>>,
]
