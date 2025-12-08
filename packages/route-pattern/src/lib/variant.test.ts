import type { Assert, IsEqual } from './type-utils'
import type { Variant } from './variant.ts'

// prettier-ignore
export type Tests = [
  // should handle simple variable patterns
  Assert<IsEqual<
    Variant<'products/:id'>,
    'products/:id'
  >>,

  // should handle optional path segments
  Assert<IsEqual<
    Variant<'products(/:id)'>,
    'products' | 'products/:id'
  >>,

  // should handle optional path segments with a leading slash
  Assert<IsEqual<
    Variant<'/products(/:id)'>,
    '/products' | '/products/:id'
  >>,

  // should handle optional extensions
  Assert<IsEqual<
    Variant<'products/:id(.:ext)'>,
    'products/:id' | 'products/:id.:ext'
  >>,

  // should handle wildcard patterns
  Assert<IsEqual<
    Variant<'files/*'>,
    'files/*'
  >>,

  // should handle wildcard with file extension
  Assert<IsEqual<
    Variant<'files/*.jpg'>,
    'files/*.jpg'
  >>,

  // should handle named wildcard patterns
  Assert<IsEqual<
    Variant<'files/*path'>,
    'files/*path'
  >>,

  // should handle wildcard with optional extension
  Assert<IsEqual<
    Variant<'files/*(.:ext)'>,
    'files/*' | 'files/*.:ext'
  >>,

  // nested optionals: variables
  Assert<IsEqual<
    Variant<'api(/:major(/:minor))'>,
    'api' | 'api/:major' | 'api/:major/:minor'
  >>,

  // nested optionals: named wildcard + variable
  Assert<IsEqual<
    Variant<'files(/*path(.:ext))'>,
    'files' | 'files/*path' | 'files/*path.:ext'
  >>,

  // nested optionals: unnamed wildcard + variable
  Assert<IsEqual<
    Variant<'files(/*(.:ext))'>,
    'files' | 'files/*' | 'files/*.:ext'
  >>,

  // should handle hostname patterns with dots
  Assert<IsEqual<
    Variant<'://api.example.com'>,
    '://api.example.com'
  >>,

  // should handle hostname patterns with variables
  Assert<IsEqual<
    Variant<'://:subdomain.example.com'>,
    '://:subdomain.example.com'
  >>,

  // should handle hostname patterns with optionals
  Assert<IsEqual<
    Variant<'://api(.staging).example.com'>,
    '://api.example.com' | '://api.staging.example.com'
  >>,

  // should handle complex hostname patterns
  Assert<IsEqual<
    Variant<'://:env(.staging).example.com'>,
    '://:env.example.com' | '://:env.staging.example.com'
  >>,

  Assert<IsEqual<
    Variant<'users(/:id)' | 'api(/:version)'>,
    'users' | 'users/:id' | 'api' | 'api/:version'
  >>
]
