import * as cp from 'node:child_process'

/**
 * Get the commit message of the current HEAD
 */
export function getHeadCommitMessage(): string {
  return cp.execSync('git log -1 --format=%s').toString().trim()
}

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
