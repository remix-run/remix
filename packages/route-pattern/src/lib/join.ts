import { splitStrings } from './split.ts'
import type { Split, SplitResult } from './split.ts'

export function join<B extends string, T extends string>(base: B, input: T): Join<B, T> {
  if (input === '') return base as Join<B, T>
  if (base === '') return input as Join<B, T>

  let b = splitStrings(base)
  let i = splitStrings(input)

  // Origin resolution: any origin info in input overwrites base origin
  let hasOrigin = i.protocol != null || i.hostname != null || i.port != null
  let protocol = hasOrigin ? i.protocol : b.protocol
  let hostname = hasOrigin ? i.hostname : b.hostname
  let port = hasOrigin ? i.port : b.port

  // Pathname resolution: concatenate base + input, ignoring trailing slash on base
  let basePath = b.pathname as string | undefined
  if (basePath && basePath.endsWith('/')) basePath = basePath.slice(0, -1)
  let inputPath = i.pathname
  let joinedPath: string | undefined
  if (inputPath && basePath) joinedPath = `${basePath}/${inputPath}`
  else if (inputPath) joinedPath = inputPath
  else joinedPath = basePath

  // Determine whether to prefix with '/'
  let hasLeadingSlash = base.startsWith('/')

  // Build origin string
  let origin =
    protocol !== undefined
      ? `${protocol}://`
      : hostname !== undefined || port !== undefined
        ? '://'
        : ''
  if (hostname !== undefined) origin += hostname
  if (port !== undefined) origin += `:${port}`

  // Build path string
  let path =
    joinedPath && joinedPath.length > 0
      ? origin !== '' || hasLeadingSlash
        ? `/${joinedPath}`
        : joinedPath
      : ''

  // Search resolution: append input to base with '&'
  let search = i.search ? (b.search ? `${b.search}&${i.search}` : i.search) : b.search

  return `${origin}${path}${search ? `?${search}` : ''}` as Join<B, T>
}

// prettier-ignore
export type Join<B extends string, T extends string> =
  T extends '' ? B :
  B extends '' ? T :
  _Join<Split<B>, Split<T>, HasLeadingSlash<B>>

// prettier-ignore
type _Join<B extends SplitResult, I extends SplitResult, LeadingSlash extends boolean> =
  HasOrigin<I['protocol'], I['hostname'], I['port']> extends true ?
    Build<
      I['protocol'],
      I['hostname'],
      I['port'],
      JoinPath<RemoveTrailingSlash<B['pathname']>, I['pathname']>,
      JoinSearch<B['search'], I['search']>,
      true,
      LeadingSlash
    > :
    Build<
      B['protocol'],
      B['hostname'],
      B['port'],
      JoinPath<RemoveTrailingSlash<B['pathname']>, I['pathname']>,
      JoinSearch<B['search'], I['search']>,
      HasOrigin<B['protocol'], B['hostname'], B['port']>,
      LeadingSlash
    >

// Has any origin info
// prettier-ignore
type HasOrigin<P, H, Po> =
  P extends string ? true :
  H extends string ? true :
  Po extends string ? true :
  false

// Remove trailing slash from a pathname string if present
type RemoveTrailingSlash<P> = P extends string ? (P extends `${infer L}/` ? L : P) : undefined

// Join base and input pathnames
// prettier-ignore
type JoinPath<B, I> =
  I extends string ?
    B extends string ?
      B extends '' ? I :
      `${B}/${I}` :
    I :
  B extends string ? B : undefined

// Join searches with '&'
// prettier-ignore
type JoinSearch<B, I> =
  I extends string ?
    B extends string ? `${B}&${I}` :
    I :
  B extends string ? B : undefined

type HasLeadingSlash<T extends string> = T extends `/${string}` ? true : false

// Assemble final string
// prettier-ignore
type Build<P, H, Po, Path, Search, OriginPresent extends boolean, LeadingSlash extends boolean> =
  `${BuildOrigin<P, H, Po>}${BuildPath<Path, OriginPresent, LeadingSlash>}${Search extends string ? `?${Search}` : ''}`

// Build origin string
// prettier-ignore
type BuildOrigin<P, H, Po> =
  P extends string ? (
    `${P}://${H extends string ? H : ''}${Po extends string ? `:${Po}` : ''}`
  ) : (
    H extends string ? `://${H}${Po extends string ? `:${Po}` : ''}` : (
      Po extends string ? `://:${Po}` : ''
    )
  )

// Build path string
// prettier-ignore
type BuildPath<Path, OriginPresent extends boolean, LeadingSlash extends boolean> =
  Path extends string ? (
    OriginPresent extends true ? `/${Path}` : (
      LeadingSlash extends true ? `/${Path}` : Path
    )
  ) : ''
