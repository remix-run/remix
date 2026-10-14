import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientEntry } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'

type DemoComponent = (handle: Handle) => () => RemixNode

export interface LoadedExample {
  Component: DemoComponent
  Preview: DemoComponent
  sourceHtml: string
}

const uiSourceDir = path.resolve(import.meta.dirname, '../../../../packages/ui/src')

export async function loadExample(module: URL): Promise<LoadedExample> {
  let relativePath = path.relative(uiSourceDir, fileURLToPath(module))
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    !relativePath.endsWith('.example.tsx') ||
    module.hash !== '' ||
    module.search !== ''
  ) {
    throw new Error(`Example must be a .example.tsx file inside packages/ui/src: ${module}`)
  }
  let mod: unknown = await import(module.href)
  if (
    mod === null ||
    typeof mod !== 'object' ||
    !('default' in mod) ||
    !isDemoComponent(mod.default)
  ) {
    throw new Error(`Example must default export a Remix component: ${module}`)
  }
  let Example = mod.default
  let source = await readFile(module, 'utf8')
  return {
    Preview: Example,
    Component: clientEntry(`${module.href}#default`, function InteractiveExample(handle) {
      return Example(handle)
    }),
    sourceHtml: await highlightSource(source),
  }
}

export async function highlightSource(source: string, lang = 'tsx'): Promise<string> {
  return renderMarkdownHtml({ type: 'root', children: [{ type: 'code', lang, value: source }] })
}

function isDemoComponent(value: unknown): value is DemoComponent {
  return typeof value === 'function'
}
