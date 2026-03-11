import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface SocialLoginConfig {
  googleClientId?: string
  googleClientSecret?: string
  githubClientId?: string
  githubClientSecret?: string
  facebookClientId?: string
  facebookClientSecret?: string
}

let didLoadDemoEnv = false
let demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let envFilePath = path.join(demoRoot, '.env')
let envExamplePath = path.join(demoRoot, '.env.example')

export function getSocialLoginConfig(source: NodeJS.ProcessEnv = process.env): SocialLoginConfig {
  loadDemoEnvFile()

  return {
    googleClientId: readEnv(source.GOOGLE_CLIENT_ID),
    googleClientSecret: readEnv(source.GOOGLE_CLIENT_SECRET),
    githubClientId: readEnv(source.GITHUB_CLIENT_ID),
    githubClientSecret: readEnv(source.GITHUB_CLIENT_SECRET),
    facebookClientId: readEnv(source.FACEBOOK_CLIENT_ID),
    facebookClientSecret: readEnv(source.FACEBOOK_CLIENT_SECRET),
  }
}

function loadDemoEnvFile(): void {
  if (didLoadDemoEnv) {
    return
  }

  didLoadDemoEnv = true

  if (!fs.existsSync(envFilePath)) {
    console.warn(
      `No .env file found for the social login demo at ${envFilePath}. Copy ${envExamplePath} to ${envFilePath} and set the provider client IDs and secrets if you want to enable the login buttons.`,
    )
    return
  }

  try {
    process.loadEnvFile(envFilePath)
  } catch (error) {
    console.warn(
      `Could not read the social login demo .env file at ${envFilePath}. The demo will still start, but provider login will stay disabled until the variables are set.`,
    )
  }
}

function readEnv(value: string | undefined): string | undefined {
  let trimmed = value?.trim()

  return trimmed ? trimmed : undefined
}
