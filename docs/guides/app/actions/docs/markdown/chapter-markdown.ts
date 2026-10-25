import { readFile } from 'node:fs/promises'

import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../../../routes.ts'
import { getMarkdownFallback } from '../examples/markdown-fallback.ts'
import type { MarkdownFallback } from '../examples/markdown-fallback.ts'
import { resolveExampleModuleUrl } from '../examples/resolve.ts'
import { replaceMarkdownFrames } from './frames.ts'

const exampleMatcher = createMatcher(routes.docs.examples.show.pattern)

// Converts a chapter's source into the markdown served at `/<chapter>.md` and copied
// into the `remix` package's `guides/` directory, so agents reading installed guides
// see the same content as the website's markdown version.
//
// Frames only render on the website, so each `::frame` is swapped for the markdown
// fallback its handler declares (see `../examples/markdown-fallback.ts`).
export async function renderChapterMarkdown(source: string): Promise<string> {
  return replaceMarkdownFrames(source, async (src) => {
    let fallback = await loadMarkdownFallback(src)
    return fallback ? renderSourceBlock(await readFile(fallback.sourceUrl, 'utf8')) : ''
  })
}

// Loads the markdown fallback declared by a frame's handler, or `undefined` when the
// frame should be stripped.
async function loadMarkdownFallback(src: string): Promise<MarkdownFallback | undefined> {
  let match = exampleMatcher.match(new URL(src, 'http://remix.local'))
  if (!match) {
    return undefined
  }

  let moduleUrl = resolveExampleModuleUrl(match.params.chapter, match.params.example)
  let mod: { handler?: unknown } = await import(moduleUrl.href)
  return getMarkdownFallback(mod.handler)
}

function renderSourceBlock(source: string): string {
  let code = source.trimEnd()
  let longestFence = Math.max(2, ...(code.match(/`{3,}/g) ?? []).map((fence) => fence.length))
  let fence = '`'.repeat(longestFence + 1)
  return `${fence}tsx\n${code}\n${fence}`
}
