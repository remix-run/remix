import { readFile } from 'node:fs/promises'
import { clientEntry } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import type { UiDocsExample, UiDocsSection } from '../../../../packages/ui/src/docs/types.ts'

type DemoComponent = (handle: Handle) => () => RemixNode

export interface LoadedExample {
  definition: UiDocsExample
  Component: DemoComponent
  Preview: DemoComponent
  sourceHtml: string
}

export interface LoadedSection {
  definition: UiDocsSection
  codeHtml: string[]
}

export async function loadSection(definition: UiDocsSection): Promise<LoadedSection> {
  return {
    definition,
    codeHtml: await Promise.all(
      (definition.code ?? []).map((code) => highlightSource(code.source, code.language)),
    ),
  }
}

export async function loadExample(definition: UiDocsExample): Promise<LoadedExample> {
  let mod: unknown = await import(definition.module.href)
  if (
    mod === null ||
    typeof mod !== 'object' ||
    !('default' in mod) ||
    !isDemoComponent(mod.default)
  ) {
    throw new Error(`Example must default export a Remix component: ${definition.module}`)
  }
  let Example = mod.default
  let source = await readFile(definition.module, 'utf8')
  return {
    definition,
    Preview: Example,
    Component: clientEntry(
      `${definition.module.href}#default`,
      function InteractiveExample(handle) {
        return Example(handle)
      },
    ),
    sourceHtml: await highlightSource(source),
  }
}

export async function highlightSource(source: string, lang = 'tsx'): Promise<string> {
  return renderMarkdownHtml({ type: 'root', children: [{ type: 'code', lang, value: source }] })
}

function isDemoComponent(value: unknown): value is DemoComponent {
  return typeof value === 'function'
}
