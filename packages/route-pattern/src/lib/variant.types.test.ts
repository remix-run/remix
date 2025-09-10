import type { Variant } from './variant.ts'
import type { Assert, IsEqual } from './type-utils.d.ts'

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

  // should handle enum patterns
  Assert<IsEqual<
    Variant<'avatar.{jpg,png,gif}'>,
    'avatar.jpg' | 'avatar.png' | 'avatar.gif'
  >>,

  // should handle optional enum patterns
  Assert<IsEqual<
    Variant<'photo(.{jpg,png})'>,
    'photo' | 'photo.jpg' | 'photo.png'
  >>,

  // should handle wildcard with enum extension
  Assert<IsEqual<
    Variant<'files/*.{jpg,png}'>,
    'files/*.jpg' | 'files/*.png'
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
  >>
]
