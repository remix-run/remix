import * as RoutePattern from '../../route-pattern/index.ts'
import { Trie, type Match } from './trie.ts'
import * as Rank from './rank.ts'

export class TrieMatcher<data> {
  #trie: Trie<data> = new Trie()
  #size: number = 0

  add(pattern: string | RoutePattern.AST, data: data) {
    pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern
    this.#trie.insert(pattern, data)
    this.#size += 1
  }

  match(url: URL) {
    let best: Match<data> | null = null
    for (let match of this.#trie.search(url)) {
      if (best === null || Rank.lessThan(match.rank, best.rank)) {
        best = match
      }
    }
    return best ? { params: best.params, data: best.data } : null
  }

  matchAll(url: URL) {
    let matches = []
    for (let match of this.#trie.search(url)) {
      matches.push(match)
    }
    matches.sort((a, b) => Rank.compare(a.rank, b.rank))
    return matches
  }

  get size() {
    return this.#size
  }
}
