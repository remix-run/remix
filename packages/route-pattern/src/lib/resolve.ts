import { split } from './split.ts'
import type { Split } from './split.ts'

export function resolve<T extends string, B extends string>(input: T, base: B): Resolve<T, B> {
  if (input === '') return base as Resolve<T, B>
  if (base === '') return input as Resolve<T, B>

  let i = split(input)
  let b = split(base)

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
  let originPresent = protocol !== undefined || hostname !== undefined || port !== undefined
  let leadingSlashWhenNoOrigin = base.startsWith('/') || input.startsWith('/')

  // Build origin string
  let origin = ''
  if (protocol !== undefined) origin = `${protocol}://`
  else if (hostname !== undefined || port !== undefined) origin = '://'
  if (hostname !== undefined) origin += hostname
  if (port !== undefined) origin += `:${port}`

  // Build path string
  let path = ''
  if (joinedPath && joinedPath.length > 0) {
    if (originPresent || leadingSlashWhenNoOrigin) path = `/${joinedPath}`
    else path = joinedPath
  }

  // Search resolution: append input to base with '&'
  let search = i.search ? (b.search ? `${b.search}&${i.search}` : i.search) : b.search
  let query = search ? `?${search}` : ''

  return `${origin}${path}${query}` as Resolve<T, B>
}

// prettier-ignore
export type Resolve<T extends string, B extends string> =
  T extends '' ? B :
  B extends '' ? T :
  _Resolve<T, B>

// prettier-ignore
type _Resolve<T extends string, B extends string> =
  Split<T> extends infer I ?
    Split<B> extends infer S ?
      I extends { protocol: infer Ip; hostname: infer Ih; port: infer Ipo; pathname: infer IpN; search: infer Is }
      ? S extends { protocol: infer Bp; hostname: infer Bh; port: infer Bpo; pathname: infer BpN; search: infer Bs }
        ? _ResolveFromParts<Ip, Ih, Ipo, IpN, Is, Bp, Bh, Bpo, BpN, Bs, T, B> : never
      : never
    : never : never

// prettier-ignore
type _ResolveFromParts<
  Ip, Ih, Ipo, IpN, Is, Bp, Bh, Bpo, BpN, Bs, T extends string, B extends string
> =
  HasOrigin<Ip, Ih, Ipo> extends true
      ? Build<
        Ip extends string ? Ip : undefined,
        Ih extends string ? Ih : undefined,
        Ipo extends string ? Ipo : undefined,
        JoinPath<RemoveTrailingSlash<BpN>, IpN>,
        JoinSearch<Bs, Is>,
        true,
        HasLeadingSlash<T, B>
      >
    : Build<
        Bp extends string ? Bp : undefined,
        Bh extends string ? Bh : undefined,
        Bpo extends string ? Bpo : undefined,
        JoinPath<RemoveTrailingSlash<BpN>, IpN>,
        JoinSearch<Bs, Is>,
        HasOrigin<Bp, Bh, Bpo>,
        HasLeadingSlash<T, B>
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
type JoinPath<BasePath, InputPath> =
  InputPath extends string ? (
    BasePath extends string ? `${BasePath}/${InputPath}` : InputPath
  ) : (
    BasePath extends string ? BasePath : undefined
  )

// Join searches with '&'
// prettier-ignore
type JoinSearch<Bs, Is> =
  Is extends string ? (
    Bs extends string ? `${Bs}&${Is}` : Is
  ) : (
    Bs extends string ? Bs : undefined
  )

// Whether to force a leading slash when no origin
// prettier-ignore
type HasLeadingSlash<T extends string, B extends string> =
  T extends `/${string}` ? true : B extends `/${string}` ? true : false

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
type BuildPath<Path, OriginPresent extends boolean, LeadingSlashWhenNoOrigin extends boolean> =
  Path extends string ? (
    OriginPresent extends true ? `/${Path}` : (
      LeadingSlashWhenNoOrigin extends true ? `/${Path}` : Path
    )
  ) : ''

// Assemble final string
// prettier-ignore
type Build<P, H, Po, Path, Search, OriginPresent extends boolean, LeadingSlashWhenNoOrigin extends boolean> =
  `${BuildOrigin<P, H, Po>}${BuildPath<Path, OriginPresent, LeadingSlashWhenNoOrigin>}${Search extends string ? `?${Search}` : ''}`
