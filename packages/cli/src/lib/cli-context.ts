import * as path from 'node:path'
import * as process from 'node:process'

import { resolveDefaultRemixVersion } from './remix-version.ts'

interface ResolveCliContextOptions {
  cwd?: string
  remixVersion?: string
}

export interface CliContext {
  cwd: string
  remixVersion?: string
}

export async function resolveCliContext(
  options: ResolveCliContextOptions = {},
): Promise<CliContext> {
  let cwd = resolveCwd(options.cwd)
  let remixVersion = normalizeRemixVersion(options.remixVersion)

  return {
    cwd,
    remixVersion: remixVersion ?? (await resolveDefaultRemixVersion(cwd)),
  }
}

function resolveCwd(cwd: string | undefined): string {
  let normalizedCwd = cwd?.trim()
  return path.resolve(
    normalizedCwd == null || normalizedCwd.length === 0 ? process.cwd() : normalizedCwd,
  )
}

function normalizeRemixVersion(remixVersion: string | undefined): string | undefined {
  let normalizedVersion = remixVersion?.trim()
  return normalizedVersion == null || normalizedVersion.length === 0 ? undefined : normalizedVersion
}
