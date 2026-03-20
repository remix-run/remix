import type { ProviderEnvPrefix } from './provider-config.ts'

import { getMissingProviderEnvVars } from './provider-config.ts'

export interface ProviderAvailability {
  google: boolean
  github: boolean
  x: boolean
}

export interface ProviderStatus {
  enabled: boolean
  missingEnvVars: string[]
}

export interface ProviderStatuses {
  google: ProviderStatus
  github: ProviderStatus
  x: ProviderStatus
}

export function getProviderAvailability(): ProviderAvailability {
  let statuses = getProviderStatuses()

  return {
    google: statuses.google.enabled,
    github: statuses.github.enabled,
    x: statuses.x.enabled,
  }
}

export function getProviderStatuses(): ProviderStatuses {
  return {
    google: getProviderStatus('GOOGLE'),
    github: getProviderStatus('GITHUB'),
    x: getProviderStatus('X'),
  }
}

function getProviderStatus(prefix: ProviderEnvPrefix): ProviderStatus {
  let missingEnvVars = getMissingProviderEnvVars(prefix)

  return {
    enabled: missingEnvVars.length === 0,
    missingEnvVars,
  }
}
