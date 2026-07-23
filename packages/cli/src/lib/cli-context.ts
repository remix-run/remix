import * as path from 'node:path'
import * as process from 'node:process'

import { resolveDefaultRemixVersion } from './remix-version.ts'
import { loadRemixConfig, type RemixConfig } from './remix-config.ts'

interface ResolveCliContextOptions {
  configPath?: string
  cwd?: string
  remixVersion?: string
}

export interface CliContext {
  config: RemixConfig
  cwd: string
  remixVersion?: string
}

export async function resolveCliContext(
  options: ResolveCliContextOptions = {},
): Promise<CliContext> {
  let cwd = resolveCwd(options.cwd)
  let remixVersion = normalizeRemixVersion(options.remixVersion)

  return {
    config: await loadRemixConfig(cwd, options.configPath),
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
