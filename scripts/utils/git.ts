import * as cp from 'node:child_process'
import * as path from 'node:path'

/**
 * Get file contents at a specific git ref.
 * Handles both absolute and relative paths (git show requires repo-relative paths).
 */
export function getFileAtRef(filepath: string, ref: string): string | null {
  // Convert absolute paths to repo-relative paths for git
  let gitPath = path.isAbsolute(filepath) ? path.relative(process.cwd(), filepath) : filepath

  try {
    return cp.execSync(`git show ${ref}:${gitPath}`).toString()
  } catch {
    return null
  }
}

/**
 * Check if a git tag exists
 */
export function tagExists(tag: string): boolean {
  try {
    cp.execSync(`git rev-parse ${tag}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
