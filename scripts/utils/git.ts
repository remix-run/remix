import * as cp from 'node:child_process'

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
