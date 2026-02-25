import { describe, expect, it } from 'vitest'
import {
  collectHtmlStreamingCssChunk,
  collectHtmlStreamingHeadHtml,
  readHtmlStreamingHeadHtml,
} from './html-streaming-contributions.ts'

function createMockRoot() {
  let stores = new Map<symbol, unknown>()
  return {
    getStore<entry>(key: symbol): undefined | entry {
      return stores.get(key) as undefined | entry
    },
    getOrCreateStore<entry>(key: symbol, create: () => entry): entry {
      let existing = stores.get(key)
      if (existing) return existing as entry
      let created = create()
      stores.set(key, created)
      return created
    },
  }
}

describe('html streaming contributions', () => {
  it('skips empty contributions', () => {
    let root = createMockRoot()
    collectHtmlStreamingHeadHtml(root as any, 'head:empty', '')
    collectHtmlStreamingCssChunk(root as any, 'css:empty', '')
    expect(readHtmlStreamingHeadHtml(root as any)).toEqual([])
  })

  it('dedupes by key and emits consolidated css style html', () => {
    let root = createMockRoot()
    collectHtmlStreamingHeadHtml(root as any, 'head:a', '<meta charset="utf-8">')
    collectHtmlStreamingHeadHtml(root as any, 'head:a', '<meta charset="ignored">')
    collectHtmlStreamingCssChunk(root as any, 'css:a', '.a{color:red;}')
    collectHtmlStreamingCssChunk(root as any, 'css:b', '.b{color:blue;}')
    collectHtmlStreamingCssChunk(root as any, 'css:b', '.b{color:ignored;}')

    let head = readHtmlStreamingHeadHtml(root as any)
    expect(head.length).toBe(2)
    expect(head[0]).toBe('<meta charset="utf-8">')
    expect(head[1]).toContain('<style ')
    expect(head[1]).toContain('.a{color:red;}.b{color:blue;}')
  })
})
