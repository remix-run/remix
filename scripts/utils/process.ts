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
  console.log(`  $ ${command}`)
  cp.execSync(command, { stdio: 'inherit', ...options })
}

export type ExecResult =
  | { ok: { stdout: string; stderr: string }; error?: undefined }
  | { ok?: undefined; error: { cause: Error; stdout: string; stderr: string } }

/**
 * Execute a command asynchronously, logging it first.
 * Never throws - callers must handle both ok and error cases.
 */
export function logAndExecAsync(command: string, options?: { cwd?: string }): Promise<ExecResult> {
  console.log(`  $ ${command}`)
  return new Promise((resolve) => {
    cp.exec(command, { encoding: 'utf-8', ...options }, (error, stdout, stderr) => {
      if (error) {
        resolve({ error: { cause: error, stdout, stderr } })
      } else {
        resolve({ ok: { stdout, stderr } })
      }
    })
  })
}
