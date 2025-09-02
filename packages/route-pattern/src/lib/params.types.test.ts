import type { Params } from './params.ts'
import type { Assert, IsEqual } from './type-utils'

// prettier-ignore
export type Tests = [
  // No params
  Assert<IsEqual<
    Params<'products'>,
    Record<string, never>
  >>,

  // Required variables in pathname
  Assert<IsEqual<
    Params<'products/:id'>,
    { id: string }
  >>,

  Assert<IsEqual<
    Params<'users/:userId/albums/:albumId'>,
    { userId: string; albumId: string }
  >>,

  // Optional variables in pathname
  Assert<IsEqual<
    Params<'products(/:id)'>,
    { id?: string }
  >>,

  Assert<IsEqual<
    Params<'products/:sku(/:variant)'>,
    { sku: string; variant?: string }
  >>,

  // Wildcards
  Assert<IsEqual<
    Params<'files/*'>,
    { '*': string }
  >>,

  Assert<IsEqual<
    Params<'files/*path'>,
    { path: string }
  >>,

  Assert<IsEqual<
    Params<'files/*(.:ext)'>,
    { '*': string; ext?: string }
  >>,

  // Unnamed wildcard within optional
  Assert<IsEqual<
    Params<'files/(*).:ext'>,
    { '*'?: string; ext: string }
  >>,

  Assert<IsEqual<
    Params<'files/*path(.:ext)'>,
    { path: string; ext?: string }
  >>,

  // Enums (no params)
  Assert<IsEqual<
    Params<'avatar.{jpg,png,gif}'>,
    Record<string, never>
  >>,

  Assert<IsEqual<
    Params<':path.{jpg,png,gif}'>,
    { path: string }
  >>,

  // Hostname/protocol params
  Assert<IsEqual<
    Params<'https://:sub.example.com/posts'>,
    { sub: string }
  >>,

  Assert<IsEqual<
    Params<':proto://example.com/path'>,
    { proto: string }
  >>,

  // Mixed host + path params
  Assert<IsEqual<
    Params<'https://:sub.example.com/:id(.:ext)'>,
    { sub: string; id: string; ext?: string }
  >>,

  // Nested optionals: variables
  Assert<IsEqual<
    Params<'api(/:major(/:minor))'>,
    { major?: string ; minor?: string }
  >>,

  // Nested optionals: named wildcard + variable
  Assert<IsEqual<
    Params<'files(/*path(.:ext))'>,
    { path?: string ; ext?: string }
  >>,

  // Nested optionals: unnamed wildcard + variable
  Assert<IsEqual<
    Params<'files(/*(.:ext))'>,
    { '*'?: string ; ext?: string }
  >>
]
