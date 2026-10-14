import type { RemixNode } from '@remix-run/component'

/** Documentation for a public UI feature, consumed by the UI docs site. */
export interface UiDocs {
  title: string
  slug: string
  category: 'primitives' | 'animation'
  description: string
  importPath: string
  examples: UiDocsExample[]
  sections?: UiDocsSection[]
}

/** A runnable example whose module is also displayed as source. */
export interface UiDocsExample {
  id: string
  title: string
  description: string
  module: URL
  section?: string
  previewSize?: 'compact'
}

/** An authored section following the live examples. */
export interface UiDocsSection {
  id: string
  title: string
  content(): RemixNode
  code?: { source: string; language?: string }[]
}
