import {
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createXAuthProvider,
} from 'remix/auth'
import type {
  GitHubAuthProfile,
  GoogleAuthProfile,
  OAuthProvider,
  OAuthResult,
  XAuthProfile,
} from 'remix/auth'

import type { SocialLoginConfig } from './config.ts'
import { routes } from './routes.ts'

export type SocialProviderName = 'google' | 'github' | 'x'
export type LoginMethod = SocialProviderName | 'password'

export interface SocialProviderState {
  name: SocialProviderName
  label: string
  configured: boolean
  missingEnv: string[]
}

export type SocialProvider =
  | OAuthProvider<GoogleAuthProfile, 'google'>
  | OAuthProvider<GitHubAuthProfile, 'github'>
  | OAuthProvider<XAuthProfile, 'x'>

export type SocialAuthResult =
  | OAuthResult<GoogleAuthProfile, 'google'>
  | OAuthResult<GitHubAuthProfile, 'github'>
  | OAuthResult<XAuthProfile, 'x'>

interface SocialProviderEnvVar {
  name: string
  read(config: SocialLoginConfig): string | undefined
}

interface SocialProviderDefinition {
  label: string
  iconHref: string
  loginHref: string
  callbackPath: string
  setupHeading: string
  envVars: [SocialProviderEnvVar, SocialProviderEnvVar]
  createProvider(origin: string, config: SocialLoginConfig): SocialProvider | null
}

let socialProviderDefinitions = {
  google: {
    label: 'Google',
    iconHref: '/icons/google.svg',
    loginHref: routes.auth.google.login.href(),
    callbackPath: routes.auth.google.callback.href(),
    setupHeading: 'Create a Google web OAuth client',
    envVars: [
      {
        name: 'GOOGLE_CLIENT_ID',
        read: config => config.googleClientId,
      },
      {
        name: 'GOOGLE_CLIENT_SECRET',
        read: config => config.googleClientSecret,
      },
    ],
    createProvider(origin, config) {
      if (!config.googleClientId || !config.googleClientSecret) {
        return null
      }

      return createGoogleAuthProvider({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        redirectUri: new URL(routes.auth.google.callback.href(), origin),
      })
    },
  },
  github: {
    label: 'GitHub',
    iconHref: '/icons/github.svg',
    loginHref: routes.auth.github.login.href(),
    callbackPath: routes.auth.github.callback.href(),
    setupHeading: 'Create a GitHub OAuth app',
    envVars: [
      {
        name: 'GITHUB_CLIENT_ID',
        read: config => config.githubClientId,
      },
      {
        name: 'GITHUB_CLIENT_SECRET',
        read: config => config.githubClientSecret,
      },
    ],
    createProvider(origin, config) {
      if (!config.githubClientId || !config.githubClientSecret) {
        return null
      }

      return createGitHubAuthProvider({
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
        redirectUri: new URL(routes.auth.github.callback.href(), origin),
      })
    },
  },
  x: {
    label: 'X',
    iconHref: '/icons/x.svg',
    loginHref: routes.auth.x.login.href(),
    callbackPath: routes.auth.x.callback.href(),
    setupHeading: 'Create an X app',
    envVars: [
      {
        name: 'X_CLIENT_ID',
        read: config => config.xClientId,
      },
      {
        name: 'X_CLIENT_SECRET',
        read: config => config.xClientSecret,
      },
    ],
    createProvider(origin, config) {
      if (!config.xClientId || !config.xClientSecret) {
        return null
      }

      return createXAuthProvider({
        clientId: config.xClientId,
        clientSecret: config.xClientSecret,
        redirectUri: new URL(routes.auth.x.callback.href(), origin),
      })
    },
  },
} as const satisfies Record<SocialProviderName, SocialProviderDefinition>

export let socialProviderNames = Object.keys(socialProviderDefinitions) as SocialProviderName[]

export function createSocialAuthProvider(
  name: SocialProviderName,
  origin: string,
  config: SocialLoginConfig,
): SocialProvider | null {
  return socialProviderDefinitions[name].createProvider(origin, config)
}

export function getProviderLabel(name: SocialProviderName): string {
  return socialProviderDefinitions[name].label
}

export function getProviderIconHref(name: SocialProviderName): string {
  return socialProviderDefinitions[name].iconHref
}

export function getProviderLoginHref(name: SocialProviderName): string {
  return socialProviderDefinitions[name].loginHref
}

export function getProviderCallbackHref(name: SocialProviderName, origin: string): string {
  return `${origin}${socialProviderDefinitions[name].callbackPath}`
}

export function getProviderEnvVars(name: SocialProviderName): string[] {
  return socialProviderDefinitions[name].envVars.map(envVar => envVar.name)
}

export function getProviderSetupHeading(name: SocialProviderName): string {
  return socialProviderDefinitions[name].setupHeading
}

export function getSocialProviderStates(config: SocialLoginConfig): SocialProviderState[] {
  return socialProviderNames.map(name => {
    let missingEnv = socialProviderDefinitions[name].envVars.flatMap(envVar =>
      envVar.read(config) ? [] : [envVar.name],
    )

    return {
      name,
      label: socialProviderDefinitions[name].label,
      configured: missingEnv.length === 0,
      missingEnv,
    }
  })
}

export function getProviderUnavailableMessage(
  name: SocialProviderName,
  config: SocialLoginConfig,
): string {
  let missingEnv = getSocialProviderStates(config).find(provider => provider.name === name)?.missingEnv ?? []

  if (missingEnv.length === 0) {
    return `${getProviderLabel(name)} login is not configured.`
  }

  return `${getProviderLabel(name)} login is not configured. Set ${missingEnv.join(' and ')}.`
}

export function getLoginMethodLabel(method: LoginMethod): string {
  if (method === 'password') {
    return 'Email and password'
  }

  return getProviderLabel(method)
}
