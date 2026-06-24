import type { Assert, IsEqual } from '../types/utils.ts'
import type { CreateHrefArgs } from '../href.ts'
import type { JoinPatterns } from '../types/join.ts'
import type { MatchParams } from '../match/types.ts'

type AcceptsCreateHrefArgs<source extends string, args extends CreateHrefArgs<source>> = args

type _RequiredHrefArgs = [
  AcceptsCreateHrefArgs<'/posts/:id', [{ id: '123' }]>,
  AcceptsCreateHrefArgs<'/posts/:id', [{ id: 123; extra: true }]>,
]

// @ts-expect-error - required id param is missing
type _MissingRequiredHrefArgs = AcceptsCreateHrefArgs<'/posts/:id', []>

type _OptionalHrefArgs = [
  AcceptsCreateHrefArgs<'/posts(/:id)', []>,
  AcceptsCreateHrefArgs<'/posts(/:id)', [null]>,
  AcceptsCreateHrefArgs<'/posts(/:id)', [{ id: null }]>,
  AcceptsCreateHrefArgs<'/posts(/:id)', [{ id: 123 }]>,
]

// @ts-expect-error - explicit protocol without hostname cannot generate an href
type _ProtocolWithoutHostnameHrefArgs = AcceptsCreateHrefArgs<'http:///posts/:id', [{ id: '123' }]>

// @ts-expect-error - dynamic protocols are invalid
type _DynamicProtocolHrefArgs = AcceptsCreateHrefArgs<':proto://example.com/path', []>

// prettier-ignore
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
    never
  >>,

  Assert<IsEqual<
    MatchParams<'http:///posts/:id'>,
    { id: string }
  >>,

  Assert<IsEqual<
    MatchParams<'https://'>,
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
  >>,

  // Public helper type surfaces
  Assert<IsEqual<
    CreateHrefArgs<'http:///posts/:id'>,
    never
  >>,

  Assert<IsEqual<
    CreateHrefArgs<'http://'>,
    never
  >>,

  Assert<IsEqual<
    CreateHrefArgs<':proto://example.com/path'>,
    never
  >>,

  Assert<IsEqual<
    JoinPatterns<'/posts/:postId', '/comments/:commentId'>,
    '/posts/:postId/comments/:commentId'
  >>,

  Assert<IsEqual<
    JoinPatterns<'https://example.com:8080/base', 'http:///next'>,
    'http://example.com:8080/base/next'
  >>,

  Assert<IsEqual<
    JoinPatterns<'/base', ':proto://example.com/path'>,
    never
  >>
]
