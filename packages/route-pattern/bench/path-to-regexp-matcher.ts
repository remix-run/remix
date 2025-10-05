import { match } from 'path-to-regexp'

interface BenchData {
  name: string
  handler: string
}

/**
 * Array-based matcher for path-to-regexp (similar to RegExpMatcher pattern)
 */
export class PathToRegexpMatcher {
  matchers: Array<{ fn: ReturnType<typeof match>; data: BenchData }> = []

  add(pattern: string, data: BenchData): void {
    let matchFn = match(pattern, { decode: decodeURIComponent })
    this.matchers.push({ fn: matchFn, data })
  }

  match(url: string | URL): { data: BenchData; params: any } | null {
    if (typeof url === 'string') url = new URL(url)

    let pathname = url.pathname

    for (let { fn, data } of this.matchers) {
      let result = fn(pathname)
      if (result !== false) {
        return { data, params: result.params }
      }
    }

    return null
  }

  get size(): number {
    return this.matchers.length
  }
}
