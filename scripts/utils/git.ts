import * as cp from 'node:child_process'

/**
 * Get file contents at a specific git ref
 */
export function getFileAtRef(filepath: string, ref: string): string | null {
  try {
    return cp.execSync(`git show ${ref}:${filepath}`).toString()
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
