import type { Assert, IsEqual } from './utils.ts'
import type { Params } from './params.ts'

// prettier-ignore
export type Tests = [
  // No params
  Assert<IsEqual<
    Params<'products'>,
    {}
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
    { id: string | undefined }
  >>,

  Assert<IsEqual<
    Params<'products/:sku(/:variant)'>,
    { sku: string; variant: string | undefined }
  >>,

  // Wildcards
  Assert<IsEqual<
    Params<'files/*'>,
    { '*': string  }
  >>,

  Assert<IsEqual<
    Params<'files/*path'>,
    { path: string  }
  >>,

  Assert<IsEqual<
    Params<'files/*(.:ext)'>,
    { '*': string; ext: string | undefined }
  >>,

  // Unnamed wildcard within optional
  Assert<IsEqual<
    Params<'files(/*).:ext'>,
    { '*': string | undefined; ext: string }
  >>,

  Assert<IsEqual<
    Params<'files/*path(.:ext)'>,
    { path: string; ext: string | undefined }
  >>,

  // Enums (no params)
  Assert<IsEqual<
    Params<'avatar.{jpg,png,gif}'>,
    {}
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
    { sub: string; id: string; ext: string | undefined }
  >>,

  // Nested optionals: variables
  Assert<IsEqual<
    Params<'api(/:major(/:minor))'>,
    { major: string | undefined; minor: string | undefined }
  >>,

  // Nested optionals: named wildcard + variable
  Assert<IsEqual<
    Params<'files(/*path(.:ext))'>,
    { path: string | undefined; ext: string | undefined }
  >>,

  // Nested optionals: unnamed wildcard + variable
  Assert<IsEqual<
    Params<'files(/*(.:ext))'>,
    { '*': string | undefined; ext: string | undefined }
  >>
]
