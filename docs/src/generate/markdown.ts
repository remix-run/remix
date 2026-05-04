import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as prettier from 'prettier'
import {
  type DocumentedAPI,
  type DocumentedClass,
  type DocumentedFunction,
  type DocumentedInterface,
  type DocumentedInterfaceFunction,
  type DocumentedType,
  type DocumentedVariable,
  type DocumentedVariableFunction,
  type ParameterOrProperty,
} from './documented-api.ts'
import { debug, info, verbose, warn } from './utils.ts'

export async function writeMarkdownFiles(comments: DocumentedAPI[], docsDir: string) {
  for (let comment of comments) {
    let mdPath = path.join(docsDir, comment.path)
    await fs.mkdir(path.dirname(mdPath), { recursive: true })
    debug('Writing markdown file:', mdPath)
    if (comment.type === 'function') {
      await fs.writeFile(mdPath, await getFunctionMarkdown(comment))
    } else if (comment.type === 'class') {
      await fs.writeFile(mdPath, await getClassMarkdown(comment))
    } else if (comment.type === 'interface') {
      await fs.writeFile(mdPath, await getInterfaceMarkdown(comment))
    } else if (comment.type === 'interface-function') {
      await fs.writeFile(mdPath, await getInterfaceFunctionMarkdown(comment))
    } else if (comment.type === 'type') {
      await fs.writeFile(mdPath, await getTypeMarkdown(comment))
    } else if (comment.type === 'variable') {
      await fs.writeFile(mdPath, await getVariableMarkdown(comment))
    } else if (comment.type === 'variable-function') {
      await fs.writeFile(mdPath, await getVariableFunctionMarkdown(comment))
    }
  }
}

const h = (level: number, heading: string, body?: string) =>
  `${'#'.repeat(level)} ${heading}${body ? `\n\n${body}` : ''}`
const h1 = (heading: string) => h(1, heading)
const h2 = (heading: string, body: string) => h(2, heading, body)
const h3 = (heading: string, body: string) => h(3, heading, body)
const code = (content: string) => `\`${content}\``
const pre = async (content: string, lang = 'ts') => {
  if (content.includes('(...)')) {
    // Prettier chokes on the ellipsis syntax in function signatures
    info(
      'Skipping formatting for code block with ellipsis syntax: ',
      content.substring(0, 50) + '...',
    )
  } else {
    try {
      content = await prettier.format(content, { parser: 'typescript' })
    } catch (e) {
      warn(
        'Failed to format code block, using unformatted content: ',
        content.length > 30 ? content.substring(0, 30) + '...' : content,
      )
      verbose(e)
    }
  }
  return `\`\`\`${lang}\n${content}\n\`\`\``
}

function frontmatter(comment: DocumentedAPI) {
  let lines = ['---', `title: ${comment.name}`]
  if (comment.source) {
    lines.push(`source: ${comment.source}`)
  }
  lines.push('---')
  return lines.join('\n')
}

function name(comment: DocumentedAPI) {
  return h1(comment.name)
}

function summary(comment: DocumentedAPI) {
  return comment.description ? h2('Summary', comment.description) : undefined
}

function aliases(comment: DocumentedAPI) {
  return comment.aliases ? h2('Aliases', comment.aliases.join(', ')) : undefined
}

async function signature(comment: DocumentedAPI) {
  return h2('Signature', await pre(comment.signature))
}

async function example(
  comment: DocumentedFunction | DocumentedClass | DocumentedVariable | DocumentedVariableFunction,
) {
  return comment.example
    ? h2(
        'Example',
        await pre(
          comment.example
            .replace(/^```[a-z]*/, '')
            .replace(/```$/, '')
            .trim(),
        ),
      )
    : undefined
}

function accessors(comment: DocumentedClass | DocumentedInterface) {
  if (!comment.accessors || comment.accessors.length === 0) return undefined
  if (comment.type === 'interface' && !comment.accessors.some((p) => p.description))
    return undefined
  return h2('Accessors', comment.accessors.map((p) => h3(code(p.name), p.description)).join('\n\n'))
}

function paramsOrProps(
  label: 'Parameters' | 'Properties',
  values: ParameterOrProperty[] | undefined,
  heading = 2,
) {
  return values && values.length > 0 && values.some((p) => p.description)
    ? h(heading, label, values.map((p) => h(heading + 1, code(p.name), p.description)).join('\n\n'))
    : undefined
}

function returns(
  comment: DocumentedFunction | DocumentedInterfaceFunction | DocumentedVariableFunction,
) {
  return comment.returns ? h2('Returns', comment.returns) : undefined
}

function methods(comment: DocumentedClass | DocumentedInterface) {
  return comment.methods &&
    comment.methods.length > 0 &&
    comment.methods.some((m) => m.description || m.parameters.some((p) => p.description))
    ? h2(
        'Methods',
        comment.methods
          .map((m) =>
            [
              h3(code(m.signature), m.description),
              paramsOrProps('Parameters', m.parameters, 4),
            ].join('\n\n'),
          )
          .join('\n\n'),
      )
    : undefined
}

export function mdSections(sections: (string | undefined)[]): string {
  return sections.filter(Boolean).join('\n\n')
}

async function getFunctionMarkdown(comment: DocumentedFunction): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
    await example(comment),
    paramsOrProps('Parameters', comment.parameters),
    returns(comment),
  ])
}

async function getClassMarkdown(comment: DocumentedClass): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
    await example(comment),
    comment.constructor &&
    (comment.constructor.description || comment.constructor.parameters.some((p) => p.description))
      ? h2(
          'Constructor',
          [
            comment.constructor.description,
            paramsOrProps('Parameters', comment.constructor.parameters, 3),
          ]
            .filter(Boolean)
            .join('\n\n'),
        )
      : undefined,
    paramsOrProps('Properties', comment.properties),
    accessors(comment),
    methods(comment),
  ])
}

async function getInterfaceMarkdown(comment: DocumentedInterface): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
    paramsOrProps('Properties', comment.properties),
    accessors(comment),
    methods(comment),
  ])
}

async function getInterfaceFunctionMarkdown(comment: DocumentedInterfaceFunction): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
    paramsOrProps('Parameters', comment.parameters),
    returns(comment),
  ])
}

async function getTypeMarkdown(comment: DocumentedType): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
  ])
}

async function getVariableMarkdown(comment: DocumentedVariable): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
    await example(comment),
  ])
}

async function getVariableFunctionMarkdown(comment: DocumentedVariableFunction): Promise<string> {
  return mdSections([
    frontmatter(comment),
    name(comment),
    summary(comment),
    aliases(comment),
    await signature(comment),
    await example(comment),
    paramsOrProps('Parameters', comment.parameters),
    returns(comment),
  ])
}
