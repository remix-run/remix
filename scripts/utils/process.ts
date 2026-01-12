import * as cp from 'node:child_process'
import * as path from 'node:path'

/**
 * Get the root directory of the monorepo (parent of scripts/).
 * Works whether called directly or via node --eval.
 */
export function getRootDir(): string {
  // import.meta.dirname is the directory containing this file (scripts/utils/)
  // Go up two levels to get the repo root
  if (import.meta.dirname) {
    return path.join(import.meta.dirname, '..', '..')
  }
  // Fallback for environments where import.meta.dirname isn't available
  return process.cwd()
}

export function logAndExec(command: string, options?: cp.ExecSyncOptions): void {
  console.log(`$ ${command}`)
  cp.execSync(command, { stdio: 'inherit', ...options })
}
