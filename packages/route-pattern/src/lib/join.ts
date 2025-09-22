import { splitStrings } from './split.ts'
import type { Split, SplitResult } from './split.ts'

export function join<B extends string, T extends string>(base: B, input: T): Join<B, T> {
  if (input === '') return base as Join<B, T>
  if (base === '') return input as Join<B, T>

  // Special case: joining '/' with '/' should result in '/'
  if (base === '/' && input === '/') return '/' as Join<B, T>

  let a = splitStrings(base)
  let b = splitStrings(input)

  let origin =
    b.hostname != null
      ? buildOrigin(b.protocol, b.hostname, b.port)
      : a.hostname != null
        ? buildOrigin(a.protocol, a.hostname, a.port)
        : ''

  let pathname =
    b.pathname != null
      ? a.pathname != null
        ? `${a.pathname.replace(/\/$/, '')}/${b.pathname}`
        : b.pathname
      : (a.pathname ?? '')

  if (pathname !== '' && !pathname.startsWith('/') && (base.startsWith('/') || origin !== '')) {
    pathname = `/${pathname}`
  }

  let search =
    b.search != null ? (a.search != null ? `${a.search}&${b.search}` : b.search) : (a.search ?? '')

  if (search !== '' && !search.startsWith('?')) {
    search = `?${search}`
  }

  return `${origin}${pathname}${search}` as Join<B, T>
}

function buildOrigin(
  protocol: string | undefined,
  hostname: string | undefined,
  port: string | undefined,
) {
  return hostname == null ? '' : `${protocol ?? ''}://${hostname}${port != null ? `:${port}` : ''}`
}

// prettier-ignore
export type Join<A extends string, B extends string> =
  B extends '' ? A :
  A extends '' ? B :
  A extends '/' ? (B extends '/' ? '/' : _Join<Split<A>, Split<B>, HasLeadingSlash<A>>) :
  _Join<Split<A>, Split<B>, HasLeadingSlash<A>>

// prettier-ignore
type _Join<A extends SplitResult, B extends SplitResult, LeadingSlash extends boolean> =
  BuildJoin<
    JoinOrigin<A, B>,
    BuildPathname<JoinPathname<A, B>, JoinOrigin<A, B>, LeadingSlash>,
    BuildSearch<JoinSearch<A, B>>
  >

type BuildJoin<
  Origin extends string,
  Pathname extends string,
  Search extends string,
> = `${Origin}${Pathname}${Search}`

type HasLeadingSlash<T extends string> = T extends `/${string}` ? true : false

// prettier-ignore
type BuildPathname<Pathname extends string, Origin extends string, LeadingSlash extends boolean> =
  Pathname extends '' ? '' :
  Pathname extends `/${string}` ? Pathname :
  Origin extends '' ?
    LeadingSlash extends true ? `/${Pathname}` : Pathname :
    `/${Pathname}`

// prettier-ignore
type BuildSearch<Search extends string> =
  Search extends '' ? '' :
  Search extends `?${string}` ? Search :
  `?${Search}`

// prettier-ignore
type JoinOrigin<A extends SplitResult, B extends SplitResult> =
  HasOrigin<B> extends true ? BuildOrigin<B> :
  HasOrigin<A> extends true ? BuildOrigin<A> :
  ''

type HasOrigin<T extends SplitResult> = T['hostname'] extends string ? true : false

// prettier-ignore
type BuildOrigin<T extends SplitResult> =
  T['hostname'] extends string ?
    `${T['protocol'] extends string ? T['protocol'] : ''}://${T['hostname']}${T['port'] extends string ? `:${T['port']}` : ''}` :
    ''

// prettier-ignore
type JoinPathname<A extends SplitResult, B extends SplitResult> =
  B['pathname'] extends string ?
    A['pathname'] extends string ?
      `${RemoveTrailingSlash<A['pathname']>}/${B['pathname']}` :
      B['pathname'] :
    A['pathname'] extends string ? A['pathname'] : ''

type RemoveTrailingSlash<T> = T extends string ? (T extends `${infer L}/` ? L : T) : undefined

// prettier-ignore
type JoinSearch<A extends SplitResult, B extends SplitResult> =
  B['search'] extends string ?
    A['search'] extends string ?
      `${A['search']}&${B['search']}` :
      B['search'] :
    A['search'] extends string ? A['search'] : ''
