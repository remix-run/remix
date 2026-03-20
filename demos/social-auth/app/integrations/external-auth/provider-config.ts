export type ExternalProviderName = 'google' | 'github' | 'x'

export type ProviderEnvPrefix = 'GOOGLE' | 'GITHUB' | 'X'

export interface ProviderCredentials {
  clientId: string
  clientSecret: string
}

export function getDemoOrigin(url?: URL): string {
  let port = url?.port || process.env.PORT || '44100'
  return `http://127.0.0.1:${port}`
}

export function getMissingProviderEnvVars(prefix: ProviderEnvPrefix): string[] {
  let missingEnvVars = []

  if (!process.env[`${prefix}_CLIENT_ID`]) {
    missingEnvVars.push(`${prefix}_CLIENT_ID`)
  }

  if (!process.env[`${prefix}_CLIENT_SECRET`]) {
    missingEnvVars.push(`${prefix}_CLIENT_SECRET`)
  }

  return missingEnvVars
}

export function readProviderCredentials(prefix: ProviderEnvPrefix): ProviderCredentials | null {
  let clientId = process.env[`${prefix}_CLIENT_ID`]
  let clientSecret = process.env[`${prefix}_CLIENT_SECRET`]

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret }
}
