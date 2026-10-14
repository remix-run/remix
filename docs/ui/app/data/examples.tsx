import { readFile } from 'node:fs/promises'
import { clientEntry } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'

type DemoComponent = (handle: Handle) => () => RemixNode

export interface LoadedExample {
  Component: DemoComponent
  Preview: DemoComponent
  sourceHtml: string
}

const examplesUrl = new URL('../examples/', import.meta.url)

export async function loadExample(name: string): Promise<LoadedExample> {
  if (!/^[\w-]+(?:\/[\w-]+)+$/.test(name)) {
    throw new Error(`Invalid UI example name: ${name}`)
  }
  let module = new URL(`${name}.example.tsx`, examplesUrl)
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
  let lines = source.split('\n')
  let indent = Infinity
  for (let line of lines) {
    if (line.trim() !== '') {
      indent = Math.min(indent, line.length - line.trimStart().length)
    }
  }
  let value = lines
    .map((line) => line.slice(indent))
    .join('\n')
    .trim()
  return renderMarkdownHtml({ type: 'root', children: [{ type: 'code', lang, value }] })
}

function isDemoComponent(value: unknown): value is DemoComponent {
  return typeof value === 'function'
}
