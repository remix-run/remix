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
} from './documented-api.ts'
import { debug, verbose, warn } from './utils.ts'

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
    }
  }
}

const h = (level: number, heading: string, body?: string) =>
  `${'#'.repeat(level)} ${heading}${body ? `\n\n${body}` : ''}`
const h1 = (heading: string) => h(1, heading)
const h2 = (heading: string, body: string) => h(2, heading, body)
const h3 = (heading: string, body: string) => h(3, heading, body)
const h4 = (heading: string, body: string) => h(4, heading, body)
const p = (content: string) => `${content}`
const pre = async (content: string, lang = 'ts') => {
  if (content.includes('(...)')) {
    // Prettier chokes on the ellipsis syntax in function signatures
    warn(
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
  return ['---', `title: ${comment.name}`, '---'].join('\n')
}

function name(comment: DocumentedAPI) {
  return h1(comment.name)
}

function source(comment: DocumentedAPI) {
  return comment.source
    ? p(`<a href="${comment.source}" target="_blank">View Source</a>`)
    : undefined
}

function summary(comment: DocumentedAPI) {
  return h2('Summary', comment.description)
}

function aliases(comment: DocumentedAPI) {
  return comment.aliases ? h2('Aliases', comment.aliases.join(', ')) : undefined
}
async function getFunctionMarkdown(comment: DocumentedFunction): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
    comment.example
      ? h2(
          'Example',
          comment.example.trim().startsWith('```') ? comment.example : await pre(comment.example),
        )
      : undefined,
    comment.parameters.length > 0
      ? h2(
          'Params',
          comment.parameters.map((param) => h3(param.name, param.description)).join('\n\n'),
        )
      : undefined,
    comment.returns ? h2('Returns', comment.returns) : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getClassMarkdown(comment: DocumentedClass): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    comment.example ? h2('Example', comment.example) : undefined,
    comment.constructor
      ? h2(
          'Constructor',
          [
            comment.constructor.description,
            ...comment.constructor.parameters.map((p) => h3(p.name, p.description)),
          ]
            .filter(Boolean)
            .join('\n\n'),
        )
      : undefined,
    comment.properties && comment.properties.length > 0
      ? h2('Properties', comment.properties.map((p) => h3(p.name, p.description)).join('\n\n'))
      : undefined,
    comment.methods && comment.methods.length > 0
      ? h2(
          'Methods',
          comment.methods
            .map((m) =>
              [
                h3(m.signature, m.description),
                ...m.parameters.map((p) => h4(p.name, p.description)),
              ].join('\n\n'),
            )
            .join('\n\n'),
        )
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getInterfaceMarkdown(comment: DocumentedInterface): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
    comment.properties && comment.properties.length > 0
      ? h2('Properties', comment.properties.map((p) => h3(p.name, p.description)).join('\n\n'))
      : undefined,
    comment.methods && comment.methods.length > 0
      ? h2(
          'Methods',
          comment.methods
            .map((m) =>
              [
                h3(m.signature, m.description),
                ...m.parameters.map((p) => h4(p.name, p.description)),
              ].join('\n\n'),
            )
            .join('\n\n'),
        )
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getInterfaceFunctionMarkdown(comment: DocumentedInterfaceFunction): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
    comment.parameters.length > 0
      ? h2(
          'Params',
          comment.parameters.map((param) => h3(param.name, param.description)).join('\n\n'),
        )
      : undefined,
    comment.returns ? h2('Returns', comment.returns) : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function getTypeMarkdown(comment: DocumentedType): Promise<string> {
  return [
    frontmatter(comment),
    name(comment),
    source(comment),
    summary(comment),
    aliases(comment),
    h2('Signature', await pre(comment.signature)),
  ]
    .filter(Boolean)
    .join('\n\n')
}
