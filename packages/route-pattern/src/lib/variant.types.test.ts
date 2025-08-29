import type { Variant } from './href.ts'
import type { Assert, IsEqual } from './test.d.ts'

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
]
