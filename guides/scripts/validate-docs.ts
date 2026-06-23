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
const examplesDir = new URL('../app/actions/docs/examples/', import.meta.url)
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
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame source uses invalid example segments: ${frame.src}`,
    )
    return
  }

  let exampleUrl = new URL(`./${chapter}/${example}.tsx`, examplesDir)

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

  if (!hasNamedHandlerExport(source, exampleUrl)) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame example must export a named handler: ${fileURLToPath(exampleUrl)}`,
    )
  }
}

function hasNamedHandlerExport(source: string, fileUrl: URL): boolean {
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
        return true
      }
      continue
    }

    if (ts.isVariableStatement(statement)) {
      if (!hasExportModifier(statement)) {
        continue
      }

      for (let declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === 'handler') {
          return true
        }
      }
      continue
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause && !statement.isTypeOnly) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (let element of statement.exportClause.elements) {
          if (!element.isTypeOnly && element.name.text === 'handler') {
            return true
          }
        }
      }
    }
  }

  return false
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false
  }

  return (
    ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
    false
  )
}

function report(chapterFile: string, lineNumber: number, message: string): void {
  errors.push(`${chapterFile}:${lineNumber}\n  ${message}`)
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
