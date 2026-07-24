import type { RemixDbAdapterConfig } from './remix-config.ts'

export type DatabaseCommand = 'migrate' | 'reset' | 'seed' | 'status' | 'wipe'

export interface DatabaseCommandInvocation {
  command: DatabaseCommand
  connectionEnv?: string
  journalTable?: string
  migrations?: string
  seed?: string
  to?: string
}

export interface DatabaseCommandPlan {
  adapter: RemixDbAdapterConfig
  command: DatabaseCommand
  journalTable?: string
  migrations?: string
  seed?: string
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
