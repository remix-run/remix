import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { info, invariant, warn } from './utils.ts'

type PackageOverview = {
  docsPackage: string
  packageDir: string
  readmePath?: string
}

const PACKAGES_DIR = path.resolve('..', 'packages')
const JAVASCRIPT_CODE_FENCE_LANGUAGES = new Set(['js', 'jsx', 'ts', 'tsx'])
const SHELL_CODE_FENCE_LANGUAGES = new Set(['', 'bash', 'sh', 'shell'])

export async function discoverPackageOverviews(): Promise<PackageOverview[]> {
  let packageDirs = await fs.readdir(PACKAGES_DIR, { withFileTypes: true })
  let overviews: PackageOverview[] = []

  for (let entry of packageDirs) {
    if (!entry.isDirectory()) continue

    let packageDir = path.join(PACKAGES_DIR, entry.name)
    let packageJsonPath = path.join(packageDir, 'package.json')

    try {
      let packageName = await readPackageName(packageJsonPath)

      let readmePath = path.join(packageDir, 'README.md')
      let hasReadme = await isFile(readmePath)

      if (!hasReadme) {
        warn(`Missing README.md for package: ${packageName}`)
      }

      let overview: PackageOverview = {
        docsPackage: getDocsPackageName(packageName),
        packageDir,
      }
      if (hasReadme) {
        overview.readmePath = readmePath
      }
      overviews.push(overview)
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'ENOENT') {
        throw error
      }
    }
  }

  return overviews.sort((a, b) => a.docsPackage.localeCompare(b.docsPackage))
}

export async function writePackageOverviewFiles(overviews: PackageOverview[], docsDir: string) {
  for (let overview of overviews) {
    let mdPath = path.join(docsDir, overview.docsPackage, 'overview.md')
    await fs.mkdir(path.dirname(mdPath), { recursive: true })
    await fs.rm(path.join(docsDir, overview.docsPackage, 'index.md'), { force: true })

    let body: string
    if (overview.readmePath) {
      body = await fs.readFile(overview.readmePath, 'utf-8')
      warnOnInvalidReadmeSyntax(body, overview.readmePath)
      body = normalizeReadmeMarkdown(body)
    } else {
      body = getMissingReadmeMarkdown(overview.docsPackage, overview.packageDir)
    }

    info(`Writing package overview file: ${mdPath}`)
    await fs.writeFile(mdPath, [frontmatter(overview), body.trim(), ''].join('\n\n'))
  }
}

async function readPackageName(packageJsonPath: string): Promise<string> {
  let packageJson: unknown = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
  invariant(
    packageJson !== null && typeof packageJson === 'object' && 'name' in packageJson,
    `Missing package name: ${packageJsonPath}`,
  )
  invariant(typeof packageJson.name === 'string', `Invalid package name: ${packageJsonPath}`)
  return packageJson.name
}

function normalizeReadmeMarkdown(markdown: string): string {
  return markdown.replace(/\]\((?:\.\/)?README\.md(#[^)]+)?\)/g, (_, hash: string | undefined) => {
    return `](${hash ?? './'})`
  })
}

function warnOnInvalidReadmeSyntax(markdown: string, readmePath: string) {
  let lines = markdown.split('\n')
  let codeFence: { lang: string; line: number } | undefined
  let codeLines: string[] = []

  for (let [index, line] of lines.entries()) {
    let fenceMatch = line.match(/^```\s*([\w-]*)/)

    if (fenceMatch) {
      if (codeFence) {
        warnOnInvalidReadmeCodeFenceSyntax(codeLines.join('\n'), codeFence, readmePath)
        codeFence = undefined
        codeLines = []
      } else {
        codeFence = { lang: fenceMatch[1]?.toLowerCase() ?? '', line: index + 1 }
      }
      continue
    }

    if (codeFence) {
      codeLines.push(line)
    }
  }

  if (codeFence) {
    warnOnInvalidReadmeCodeFenceSyntax(codeLines.join('\n'), codeFence, readmePath)
  }
}

function warnOnInvalidReadmeCodeFenceSyntax(
  code: string,
  codeFence: { lang: string; line: number },
  readmePath: string,
) {
  let relativeReadmePath = path.relative(process.cwd(), readmePath)

  if (
    JAVASCRIPT_CODE_FENCE_LANGUAGES.has(codeFence.lang) &&
    (/\bfrom\s+['"]@remix-run\//.test(code) || /\bimport\s*\(\s*['"]@remix-run\//.test(code))
  ) {
    warn(
      `Potential invalid import syntax in ${relativeReadmePath}:${codeFence.line}. ` +
        `Prefer importing from \`remix/*\` instead of \`@remix-run/*\`.`,
    )
  }

  if (
    SHELL_CODE_FENCE_LANGUAGES.has(codeFence.lang) &&
    /\b(?:npm\s+(?:i|install)|pnpm\s+add|yarn\s+add|bun\s+add)\s+[^\n]*@remix-run\//.test(code)
  ) {
    warn(
      `Potential invalid install syntax in ${relativeReadmePath}:${codeFence.line}. ` +
        `Prefer installing \`remix\` instead of \`@remix-run/*\`.`,
    )
  }
}

function getDocsPackageName(packageName: string): string {
  if (packageName === 'remix') {
    return 'remix'
  }

  let match = packageName.match(/^@remix-run\/(.+)$/)
  invariant(match, `Unexpected package name: ${packageName}`)

  return `remix/${match[1]}`
}

function frontmatter(overview: PackageOverview): string {
  return ['---', 'type: package', `title: ${overview.docsPackage}`, '---'].join('\n')
}

function getMissingReadmeMarkdown(docsPackage: string, packageDir: string): string {
  let relativePackageDir = path.relative(path.resolve('..'), packageDir)
  return [
    `# ${docsPackage}`,
    '',
    `This package does not have a README yet. Add one at \`${relativePackageDir}/README.md\`.`,
  ].join('\n')
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    let stat = await fs.stat(filePath)
    return stat.isFile()
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
