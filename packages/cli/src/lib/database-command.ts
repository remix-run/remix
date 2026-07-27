// Shared between commands/db.ts and run-db-worker.ts so the parent process
// and the spawned worker always agree on the invocation shape.
export type DatabaseCommand = 'migrate' | 'reset' | 'seed' | 'status' | 'wipe'

export interface DatabaseCommandInvocation {
  command: DatabaseCommand
  to?: string
}

export function isDatabaseCommand(value: unknown): value is DatabaseCommand {
  return (
    value === 'migrate' ||
    value === 'reset' ||
    value === 'seed' ||
    value === 'status' ||
    value === 'wipe'
  )
}
