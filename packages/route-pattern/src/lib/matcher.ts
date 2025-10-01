import type { RoutePattern } from './route-pattern.ts'

export interface Matcher<T = any> {
  add<P extends string>(pattern: P | RoutePattern<P>, data: T): void
  match(url: string | URL): MatchResult<T> | null
  matchAll(url: string | URL): Generator<MatchResult<T>>
  size: number
}

export interface MatchResult<T = any> {
  data: T
  params: Record<string, string>
  url: URL
}
