import type { RemixDbAdapterConfig } from './remix-config.ts'

export type DatabaseCommand = 'migrate' | 'reset' | 'rollback' | 'seed' | 'status' | 'wipe'

export interface DatabaseCommandInvocation {
  command: DatabaseCommand
  connectionEnv?: string
  dryRun?: boolean
  journalTable?: string
  migrations?: string
  seed?: string
  step?: number
  to?: string
}

export interface DatabaseCommandPlan {
  adapter: RemixDbAdapterConfig
  command: DatabaseCommand
  dryRun?: boolean
  journalTable?: string
  migrations?: string
  seed?: string
  step?: number
  to?: string
}

export function isDatabaseCommand(value: unknown): value is DatabaseCommand {
  return (
    value === 'migrate' ||
    value === 'reset' ||
    value === 'rollback' ||
    value === 'seed' ||
    value === 'status' ||
    value === 'wipe'
  )
}
