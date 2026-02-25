import type { StreamingRendererRoot } from '@remix-run/reconciler'
import { CSS_MIXIN_STYLE_TAG_ATTR, CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR } from './mixins/css-shared.ts'

let HTML_STREAMING_HEAD_HTML_STORE_KEY = Symbol.for('rmx.dom.streaming.head-html')
let HTML_STREAMING_CSS_CHUNKS_STORE_KEY = Symbol.for('rmx.dom.streaming.css-chunks')

type HeadHtmlContributions = Map<string, string>
type CssChunkContributions = Map<string, string>

export function collectHtmlStreamingHeadHtml(
  root: StreamingRendererRoot<any>,
  key: string,
  html: string,
) {
  if (!html) return
  let entries = root.getOrCreateStore<HeadHtmlContributions>(HTML_STREAMING_HEAD_HTML_STORE_KEY, () => new Map())
  if (entries.has(key)) return
  entries.set(key, html)
}

export function collectHtmlStreamingCssChunk(
  root: StreamingRendererRoot<any>,
  key: string,
  cssText: string,
) {
  if (!cssText) return
  let entries = root.getOrCreateStore<CssChunkContributions>(HTML_STREAMING_CSS_CHUNKS_STORE_KEY, () => new Map())
  if (entries.has(key)) return
  entries.set(key, cssText)
}

export function readHtmlStreamingHeadHtml(root: StreamingRendererRoot<any>) {
  let headHtml = readRawHeadHtml(root)
  let cssHtml = readConsolidatedCssHeadHtml(root)
  if (!cssHtml) return headHtml
  return headHtml.concat(cssHtml)
}

function readRawHeadHtml(root: StreamingRendererRoot<any>) {
  let entries = root.getStore<HeadHtmlContributions>(HTML_STREAMING_HEAD_HTML_STORE_KEY)
  if (!entries || entries.size === 0) return []
  return Array.from(entries.values())
}

function readConsolidatedCssHeadHtml(root: StreamingRendererRoot<any>) {
  let cssEntries = root.getStore<CssChunkContributions>(HTML_STREAMING_CSS_CHUNKS_STORE_KEY)
  if (!cssEntries || cssEntries.size === 0) return ''
  let cssText = Array.from(cssEntries.values()).join('')
  return `<style ${CSS_MIXIN_STYLE_TAG_ATTR} ${CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR}="server">${cssText}</style>`
}
