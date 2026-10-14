import type { Handle, RemixNode } from 'remix/component'
import type { LoadedExample } from './examples.tsx'

export interface PageMeta {
  title: string
  slug: string
  category: 'primitives' | 'animation'
  description: string
  importPath: string
}

export interface PageProps {
  pages: UiPage[]
}

export interface UiPage extends PageMeta {
  Component: (handle: Handle<PageProps>) => () => RemixNode
  preview?: LoadedExample
}
