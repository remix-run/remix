import type { Assert, IsEqual } from '../types/utils.ts'
import type { MatchParams } from '../match/types.ts'

// oxfmt-ignore
export type Tests = [
  // No params
  Assert<IsEqual<
    MatchParams<'products'>,
    {}
  >>,

  // Required variables in pathname
  Assert<IsEqual<
    MatchParams<'products/:id'>,
    { id: string }
  >>,

  Assert<IsEqual<
    MatchParams<'users/:userId/albums/:albumId'>,
    { userId: string; albumId: string }
  >>,

  // Optional variables in pathname
  Assert<IsEqual<
    MatchParams<'products(/:id)'>,
    { id: string | undefined }
  >>,

  Assert<IsEqual<
    MatchParams<'products/:sku(/:variant)'>,
    { sku: string; variant: string | undefined }
  >>,

  // Wildcards
  Assert<IsEqual<
    MatchParams<'files/*'>,
    {}
  >>,

  Assert<IsEqual<
    MatchParams<'files/*path'>,
    { path: string  }
  >>,

  Assert<IsEqual<
    MatchParams<'files/*(.:ext)'>,
    { ext: string | undefined }
  >>,

  // Unnamed wildcard within optional
  Assert<IsEqual<
    MatchParams<'files(/*).:ext'>,
    { ext: string }
  >>,

  Assert<IsEqual<
    MatchParams<'files/*path(.:ext)'>,
    { path: string; ext: string | undefined }
  >>,

  // Enums (no params)
  Assert<IsEqual<
    MatchParams<'avatar.{jpg,png,gif}'>,
    {}
  >>,

  Assert<IsEqual<
    MatchParams<':path.{jpg,png,gif}'>,
    { path: string }
  >>,

  // Hostname/protocol params
  Assert<IsEqual<
    MatchParams<'https://:sub.example.com/posts'>,
    { sub: string }
  >>,

  Assert<IsEqual<
    MatchParams<':proto://example.com/path'>,
    {}
  >>,

  // Mixed host + path params
  Assert<IsEqual<
    MatchParams<'https://:sub.example.com/:id(.:ext)'>,
    { sub: string; id: string; ext: string | undefined }
  >>,

  // Nested optionals: variables
  Assert<IsEqual<
    MatchParams<'api(/:major(/:minor))'>,
    { major: string | undefined; minor: string | undefined }
  >>,

  // Nested optionals: named wildcard + variable
  Assert<IsEqual<
    MatchParams<'files(/*path(.:ext))'>,
    { path: string | undefined; ext: string | undefined }
  >>,

  // Nested optionals: unnamed wildcard + variable
  Assert<IsEqual<
    MatchParams<'files(/*(.:ext))'>,
    { ext: string | undefined }
  >>
]
