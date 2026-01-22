import * as fs from 'node:fs'
import * as path from 'node:path'
import * as frontmatter from 'front-matter'

// No types exist for the `frontmatter` package
const parseFrontmatter = frontmatter.default as unknown as (md: string) => {
  attributes: Record<string, any>
  body: string
}

const REPO_DIR = path.resolve(process.cwd(), '..')

export type ContentType = 'doc' | 'source' | 'demo'

export type IndexedContent = {
  path: string
  type: ContentType
  package: string
  name: string
  content: string
  exports?: string[]
}

export type ContentIndex = {
  docs: IndexedContent[]
  source: IndexedContent[]
  demos: IndexedContent[]
  all: IndexedContent[]
}

let cachedIndex: ContentIndex | null = null

export async function getContentIndex(): Promise<ContentIndex> {
  if (cachedIndex) {
    return cachedIndex
  }

  let docs = await indexDocs()
  let source = await indexSource()
  let demos = await indexDemos()

  cachedIndex = {
    docs,
    source,
    demos,
    all: [...docs, ...source, ...demos],
  }

  return cachedIndex
}

async function indexDocs(): Promise<IndexedContent[]> {
  let docsDir = path.resolve(REPO_DIR, 'docs', 'api')
  let files: IndexedContent[] = []

  walk(docsDir)

  return files

  function walk(dir: string) {
    let entries = fs.readdirSync(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          let relativePath = path.relative(docsDir, fullPath)
          let parts = relativePath.split(path.sep)
          let packageName = parts.slice(0, parts.length - 1).join('/')

          let markdown = fs.readFileSync(fullPath, 'utf-8')
          let { body, attributes } = parseFrontmatter(markdown)

          files.push({
            path: fullPath,
            type: 'doc',
            package: packageName || 'remix',
            name: entry.name.replace(/\.md$/, ''),
            content: body,
            exports: attributes.exports ? [attributes.exports] : [],
          })
        } catch (error) {
          console.error(`Error indexing doc ${fullPath}:`, error)
        }
      }
    }
  }
}

async function indexSource(): Promise<IndexedContent[]> {
  let packagesDir = path.resolve(REPO_DIR, 'packages')
  let files: IndexedContent[] = []

  let packages = fs.readdirSync(packagesDir, { withFileTypes: true })

  for (let pkg of packages) {
    if (!pkg.isDirectory()) continue

    let srcDir = path.join(packagesDir, pkg.name, 'src')
    if (!fs.existsSync(srcDir)) continue

    walkSource(srcDir, pkg.name)
  }

  return files

  function walkSource(dir: string, packageName: string) {
    let entries = fs.readdirSync(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walkSource(fullPath, packageName)
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        try {
          let content = fs.readFileSync(fullPath, 'utf-8')

          // Extract exports for better searchability
          let exports = extractExports(content)

          files.push({
            path: fullPath,
            type: 'source',
            package: packageName,
            name: entry.name.replace(/\.ts$/, ''),
            content,
            exports,
          })
        } catch (error) {
          console.error(`Error indexing source ${fullPath}:`, error)
        }
      }
    }
  }
}

async function indexDemos(): Promise<IndexedContent[]> {
  let demosDir = path.resolve(REPO_DIR, 'demos')
  let files: IndexedContent[] = []

  if (!fs.existsSync(demosDir)) {
    return files
  }

  let demos = fs.readdirSync(demosDir, { withFileTypes: true })

  for (let demo of demos) {
    if (!demo.isDirectory()) continue

    let appDir = path.join(demosDir, demo.name, 'app')
    if (!fs.existsSync(appDir)) continue

    walkDemo(appDir, demo.name)
  }

  return files

  function walkDemo(dir: string, demoName: string) {
    let entries = fs.readdirSync(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walkDemo(fullPath, demoName)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        // Skip test files
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
          continue
        }

        try {
          let content = fs.readFileSync(fullPath, 'utf-8')
          let exports = extractExports(content)

          files.push({
            path: fullPath,
            type: 'demo',
            package: demoName,
            name: entry.name,
            content,
            exports,
          })
        } catch (error) {
          console.error(`Error indexing demo ${fullPath}:`, error)
        }
      }
    }
  }
}

function extractExports(content: string): string[] {
  let exports: string[] = []

  // Match export function/const/class declarations
  let exportRegex =
    /export\s+(?:async\s+)?(?:function|const|let|class|type|interface)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
  let match: RegExpExecArray | null

  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1])
  }

  return exports
}

export function searchContent(index: ContentIndex, query: string, limit = 10): IndexedContent[] {
  // Extract keywords from query (simple approach)
  let keywords = extractKeywords(query)

  // Score each content item
  let scored = index.all.map((item) => ({
    item,
    score: scoreContent(item, keywords, query),
  }))

  // Sort by score and return top results
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item)
}

function extractKeywords(query: string): string[] {
  // Convert to lowercase and split on non-word characters
  let words = query.toLowerCase().split(/\W+/)

  // Remove common stop words
  let stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'do',
    'for',
    'from',
    'how',
    'i',
    'in',
    'is',
    'it',
    'of',
    'on',
    'or',
    'that',
    'the',
    'to',
    'was',
    'what',
    'when',
    'where',
    'which',
    'who',
    'will',
    'with',
  ])

  return words.filter((w) => w.length > 2 && !stopWords.has(w))
}

function scoreContent(item: IndexedContent, keywords: string[], fullQuery: string): number {
  let score = 0
  let searchText = `${item.name} ${item.content} ${item.exports?.join(' ') || ''}`.toLowerCase()

  // Exact phrase match - highest score
  if (searchText.includes(fullQuery.toLowerCase())) {
    score += 100
  }

  // Keyword matches
  for (let keyword of keywords) {
    let matches = (searchText.match(new RegExp(keyword, 'gi')) || []).length
    score += matches * 10
  }

  // Export name matches - boost score
  if (item.exports) {
    for (let exp of item.exports) {
      for (let keyword of keywords) {
        if (exp.toLowerCase().includes(keyword)) {
          score += 20
        }
      }
    }
  }

  // Prioritize docs over source over demos
  if (item.type === 'doc') {
    score *= 1.5
  } else if (item.type === 'source') {
    score *= 1.2
  }

  return score
}
