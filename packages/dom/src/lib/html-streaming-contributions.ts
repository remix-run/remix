import type { StreamingRendererRoot } from '@remix-run/reconciler'

let HTML_STREAMING_HEAD_HTML_STORE_KEY = Symbol.for('rmx.dom.streaming.head-html')

type HeadHtmlContributions = Map<string, string>

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

export function readHtmlStreamingHeadHtml(root: StreamingRendererRoot<any>) {
  let entries = root.getStore<HeadHtmlContributions>(HTML_STREAMING_HEAD_HTML_STORE_KEY)
  if (!entries || entries.size === 0) return []
  return Array.from(entries.values())
}
