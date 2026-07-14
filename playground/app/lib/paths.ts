/**
 * Pure path helpers shared across the store, operations, and components.
 */
import type * as almost from '@jacob-ebey/almostnode'

/**
 * Resolve any user/tool/UI-supplied path to a single canonical absolute path:
 * one leading slash, no empty/`.`/`..` segments. This is the single source of
 * truth for file identity, so `/some/file.ts`, `some/file.ts`, and
 * `./some/file.ts` all collapse to the same key and can never open as separate
 * tabs or models.
 */
export function normalizePath(path: string): string {
  let segments: string[] = []
  for (let segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return `/${segments.join('/')}`
}

/** Monaco language id for a file path's extension. */
export function languageFor(path: string): string {
  let ext = path.slice(path.lastIndexOf('.') + 1)
  switch (ext) {
    case 'sql':
      return 'sql'
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'json':
      return 'json'
    default:
      return 'plaintext'
  }
}

/** Human-readable language label for the status bar. */
export function languageLabel(path: string | undefined): string {
  if (!path) return ''
  if (path.endsWith('.tsx')) return 'TypeScript JSX'
  if (path.endsWith('.ts') || path.endsWith('.mts')) return 'TypeScript'
  if (path.endsWith('.jsx')) return 'JavaScript JSX'
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'JavaScript'
  if (path.endsWith('.json')) return 'JSON'
  if (path.endsWith('.css')) return 'CSS'
  if (path.endsWith('.html')) return 'HTML'
  if (path.endsWith('.sql')) return 'SQL'
  return 'Plain Text'
}

/** Render a `tree`-style listing of a VFS directory, used by the agent's `list` tool. */
export function ls(vfs: almost.VirtualFS, path: string, depth: number): string {
  let output = ''
  function walk(dir: string, prefix = ''): void {
    if (depth < 0 || dir === 'node_modules') return
    let entries = vfs.readdirSync(dir) || []
    entries.forEach((entry, index) => {
      let isLast = index === entries.length - 1
      let marker = isLast ? '└── ' : '├── '
      output += `${prefix}${marker}${entry}\n`
      let stats = vfs.statSync(`${dir}/${entry}`)
      if (stats?.isDirectory()) {
        walk(`${dir}/${entry}`, `${prefix}${isLast ? '    ' : '│   '}`)
      }
    })
  }
  walk(path)
  return output || 'Directory is empty or does not exist.'
}
