export interface SocialLoginConfig {
  googleClientId?: string
  googleClientSecret?: string
  githubClientId?: string
  githubClientSecret?: string
  facebookClientId?: string
  facebookClientSecret?: string
}

export function getSocialLoginConfig(source: NodeJS.ProcessEnv = process.env): SocialLoginConfig {
  return {
    googleClientId: readEnv(source.GOOGLE_CLIENT_ID),
    googleClientSecret: readEnv(source.GOOGLE_CLIENT_SECRET),
    githubClientId: readEnv(source.GITHUB_CLIENT_ID),
    githubClientSecret: readEnv(source.GITHUB_CLIENT_SECRET),
    facebookClientId: readEnv(source.FACEBOOK_CLIENT_ID),
    facebookClientSecret: readEnv(source.FACEBOOK_CLIENT_SECRET),
  }
}

function readEnv(value: string | undefined): string | undefined {
  let trimmed = value?.trim()

  return trimmed ? trimmed : undefined
}
