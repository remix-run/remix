import * as process from 'node:process'

export interface CliRuntimeContext {
  cwd?: string
  remixVersion?: string
}

let currentContext: CliRuntimeContext = {}

export function getCliRuntimeContext(): CliRuntimeContext {
  return currentContext
}

export function getRuntimeRemixVersion(): string | undefined {
  let remixVersion = currentContext.remixVersion?.trim()
  return remixVersion && remixVersion.length > 0 ? remixVersion : undefined
}

export function getRuntimeCwd(): string {
  let cwd = currentContext.cwd?.trim()
  return cwd && cwd.length > 0 ? cwd : process.cwd()
}

export function setCliRuntimeContext(context: CliRuntimeContext): CliRuntimeContext {
  let previousContext = currentContext
  currentContext = { ...context }
  return previousContext
}
