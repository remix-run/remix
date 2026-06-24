import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createMatcher } from 'remix/route-pattern/match'
import * as ts from 'typescript'

import { readMarkdownFrameReferences } from '../app/actions/docs/markdown.tsx'
import { routes } from '../app/routes.ts'

type DocsFrame = {
  chapterFile: string
  lineNumber: number
  src: string
}

const chaptersDir = new URL('../app/actions/docs/chapters/', import.meta.url)
const chapterExamplesDir = new URL('../app/actions/docs/examples/', import.meta.url)
const docsExampleMatcher = createMatcher(routes.docs.examples.show.pattern)
const exampleSegmentPattern = /^[a-z0-9][a-z0-9-]*$/

const errors: string[] = []
const frames: DocsFrame[] = []

for (let entry of await readdir(chaptersDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.md')) {
    continue
  }

  let fileUrl = new URL(entry.name, chaptersDir)
  let source = await readFile(fileUrl, 'utf8')
  frames.push(
    ...readMarkdownFrameReferences(source).map((frame) => ({
      chapterFile: entry.name,
      lineNumber: frame.lineNumber,
      src: frame.src,
    })),
  )
}

for (let frame of frames) {
  await validateFrame(frame)
}

if (errors.length > 0) {
  console.error(
    `Docs validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`,
  )
  for (let error of errors) {
    console.error(`\n${error}`)
  }
  process.exitCode = 1
} else {
  console.log(`Validated ${frames.length} docs frame${frames.length === 1 ? '' : 's'}.`)
}

async function validateFrame(frame: DocsFrame): Promise<void> {
  let match = docsExampleMatcher.match(new URL(frame.src, 'http://remix.local'))

  if (!match) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame source must match ${routes.docs.examples.show.pattern.toString()}: ${frame.src}`,
    )
    return
  }

  let { chapter, example } = match.params

  if (!exampleSegmentPattern.test(chapter) || !exampleSegmentPattern.test(example)) {
    report(frame.chapterFile, frame.lineNumber, `Frame source uses invalid segments: ${frame.src}`)
    return
  }

  let expectedChapter = readChapterSlug(frame.chapterFile)
  if (chapter !== expectedChapter) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame source must be scoped to /docs/examples/${expectedChapter}/..., received: ${frame.src}`,
    )
    return
  }

  let exampleUrl = new URL(`./${chapter}/${example}.tsx`, chapterExamplesDir)

  let source: string
  try {
    source = await readFile(exampleUrl, 'utf8')
  } catch (error) {
    if (isNotFoundError(error)) {
      report(
        frame.chapterFile,
        frame.lineNumber,
        `Frame source points to a missing example file: ${fileURLToPath(exampleUrl)}`,
      )
      return
    }

    throw error
  }

  let exportType = readFrameExampleExport(source, exampleUrl)
  if (!exportType) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame example must export a named handler or default component: ${fileURLToPath(exampleUrl)}`,
    )
    return
  }

  if (exportType === 'default' && !hasDemoMetadata(source, exampleUrl)) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Default component frame example must include @name and @description metadata: ${fileURLToPath(
        exampleUrl,
      )}`,
    )
  }
}

type FrameExampleExport = 'handler' | 'default'

function readFrameExampleExport(source: string, fileUrl: URL): FrameExampleExport | undefined {
  let sourceFile = ts.createSourceFile(
    fileURLToPath(fileUrl),
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  for (let statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (statement.name?.text === 'handler' && hasExportModifier(statement)) {
        return 'handler'
      }
      if (hasExportModifier(statement) && hasDefaultModifier(statement)) {
        return 'default'
      }
      continue
    }

    if (ts.isVariableStatement(statement)) {
      if (!hasExportModifier(statement)) {
        continue
      }

      for (let declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === 'handler') {
          return 'handler'
        }
      }
      continue
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause && !statement.isTypeOnly) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (let element of statement.exportClause.elements) {
          if (!element.isTypeOnly && element.name.text === 'handler') {
            return 'handler'
          }
        }
      }
    }
  }

  return undefined
}

function hasDemoMetadata(source: string, fileUrl: URL): boolean {
  let sourceFile = ts.createSourceFile(
    fileURLToPath(fileUrl),
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  for (let statement of sourceFile.statements) {
    let tags = ts.getJSDocTags(statement)
    let hasName = hasJsdocTag(tags, 'name')
    let hasDescription = hasJsdocTag(tags, 'description')

    if (hasName && hasDescription) {
      return true
    }
  }

  return false
}

function hasJsdocTag(tags: readonly ts.JSDocTag[], tagName: 'name' | 'description'): boolean {
  let tag = tags.find((candidate) => candidate.tagName.text === tagName)
  return readJsdocTagComment(tag?.comment) !== undefined
}

function readJsdocTagComment(comment: ts.JSDocTag['comment']): string | undefined {
  let text =
    typeof comment === 'string'
      ? comment
      : Array.isArray(comment)
        ? comment.map((part) => part.text).join('')
        : ''
  let trimmed = text.trim()
  return trimmed === '' ? undefined : trimmed
}

function hasExportModifier(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword)
}

function hasDefaultModifier(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.DefaultKeyword)
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false
  }

  return ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false
}

function readChapterSlug(chapterFile: string): string {
  let match = /^\d+-([a-z0-9][a-z0-9-]*)\.md$/.exec(chapterFile)
  if (!match?.[1]) {
    throw new Error(`Expected chapter file name to include a slug: ${chapterFile}`)
  }
  return match[1]
}

function report(chapterFile: string, lineNumber: number, message: string): void {
  errors.push(`${chapterFile}:${lineNumber}\n  ${message}`)
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
