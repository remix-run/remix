import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createMatcher } from 'remix/route-pattern/match'
import * as ts from 'typescript'

import { readMarkdownFrameReferences } from '../app/actions/docs/markdown/frames.ts'
import { isExampleSegment, resolveExampleModuleUrl } from '../app/actions/docs/examples/resolve.ts'
import { routes } from '../app/routes.ts'

type DocsFrame = {
  chapterFile: string
  lineNumber: number
  src: string
}

const chaptersDir = new URL('../app/actions/docs/chapters/', import.meta.url)
const docsExampleMatcher = createMatcher(routes.docs.examples.show.pattern)

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

  if (!isExampleSegment(chapter) || !isExampleSegment(example)) {
    report(frame.chapterFile, frame.lineNumber, `Frame source uses invalid segments: ${frame.src}`)
    return
  }

  let expectedChapter = readChapterDir(frame.chapterFile)
  if (chapter !== expectedChapter) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame source must be scoped to /examples/${expectedChapter}/..., received: ${frame.src}`,
    )
    return
  }

  let exampleUrl = resolveExampleModuleUrl(chapter, example)

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

  if (!exportsHandler(source, exampleUrl)) {
    report(
      frame.chapterFile,
      frame.lineNumber,
      `Frame example must export a named \`handler\`: ${fileURLToPath(exampleUrl)}`,
    )
  }
}

// Checks whether a frame example module exports a `handler` (as a function,
// const, or re-exported named export).
function exportsHandler(source: string, fileUrl: URL): boolean {
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
  return hasModifier(node, ts.SyntaxKind.ExportKeyword)
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false
  }

  return ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false
}

// The example directory mirrors the chapter file name (e.g. `17-markdown-style-demo`),
// including the order prefix, so frames stay scoped to the chapter that references them.
function readChapterDir(chapterFile: string): string {
  let match = /^(\d+-[a-z0-9][a-z0-9-]*)\.md$/.exec(chapterFile)
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
