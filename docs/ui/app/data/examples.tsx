import { readFile } from 'node:fs/promises'
import { format } from 'oxfmt'
import { clientEntry } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import oxfmtConfig from '../../../../oxfmt.config.ts'

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

  let extension = snippetExtensions.get(lang)
  if (value && extension) {
    try {
      let result = await format(`snippet.${extension}`, value, oxfmtConfig)
      if (result.errors.length > 0) {
        throw new Error(result.errors.map((error) => error.codeframe ?? error.message).join('\n'))
      }
      value = result.code.trim()
      if (extension === 'tsx' || extension === 'jsx') {
        let fragment = value.replace(/^;(?=<)/gm, '')
        if (fragment !== value) {
          // Keep required separators and literal text by checking that removing
          // JSX prefixes still formats to exactly the same code.
          let checked = await format(`snippet.${extension}`, fragment, oxfmtConfig)
          if (checked.errors.length === 0 && checked.code.trim() === value) {
            value = fragment
          }
        }
      }
    } catch (error) {
      console.warn(`Unable to format UI docs snippet (${lang}). Displaying original source.`, error)
    }
  }

  return renderMarkdownHtml({ type: 'root', children: [{ type: 'code', lang, value }] })
}

const snippetExtensions = new Map([
  ['ts', 'ts'],
  ['typescript', 'ts'],
  ['tsx', 'tsx'],
  ['js', 'js'],
  ['javascript', 'js'],
  ['jsx', 'jsx'],
  ['json', 'json'],
  ['jsonc', 'jsonc'],
  ['css', 'css'],
  ['html', 'html'],
])

function isDemoComponent(value: unknown): value is DemoComponent {
  return typeof value === 'function'
}
