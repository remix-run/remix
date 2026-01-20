import type { Assert, IsEqual } from './utils.ts'
import type { Parse } from './parse.ts'
import type { Stringify } from './stringify.ts'

export type Tests = [
  Assert<IsEqual<Stringify<Parse<''>>, '/'>>,
  Assert<IsEqual<Stringify<Parse<'http'>>, '/http'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world'>>, '/hello/world'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world?q=1'>>, '/hello/world?q=1'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world?q=1&q=2'>>, '/hello/world?q=1&q=2'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world?q=1&a=2'>>, '/hello/world?q=1&a=2'>>,

  Assert<IsEqual<Stringify<Parse<'http://example.com'>>, 'http://example.com/'>>,
  Assert<IsEqual<Stringify<Parse<'https://example.com/path'>>, 'https://example.com/path'>>,
  Assert<IsEqual<Stringify<Parse<'https://example.com/path?q=1'>>, 'https://example.com/path?q=1'>>,
  Assert<
    IsEqual<
      Stringify<Parse<'https://example.com/path?q=1&q=2'>>,
      'https://example.com/path?q=1&q=2'
    >
  >,
  Assert<
    IsEqual<
      Stringify<Parse<'https://example.com/path?q=1&a=2'>>,
      'https://example.com/path?q=1&a=2'
    >
  >,
]
