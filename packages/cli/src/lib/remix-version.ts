import { remixVersionUnavailable } from './errors.ts'
import { getRuntimeRemixVersion } from './runtime-context.ts'

export function readRemixVersion(): string {
  let remixVersion = getRuntimeRemixVersion()
  if (remixVersion == null) {
    throw remixVersionUnavailable()
  }

  return remixVersion
}
