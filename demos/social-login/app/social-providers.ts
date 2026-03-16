import {
  createGitHubAuthProvider as createRemixGitHubAuthProvider,
  createGoogleAuthProvider as createRemixGoogleAuthProvider,
  createXAuthProvider as createRemixXAuthProvider,
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

export let socialProviderNames: SocialProviderName[] = ['google', 'github', 'x']

export function createGoogleAuthProvider(
  origin: string,
  config: SocialLoginConfig,
): OAuthProvider<GoogleAuthProfile, 'google'> | null {
  if (!config.googleClientId || !config.googleClientSecret) {
    return null
  }

  return createRemixGoogleAuthProvider({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: new URL(routes.auth.google.callback.href(), origin),
  })
}

export function createGitHubAuthProvider(
  origin: string,
  config: SocialLoginConfig,
): OAuthProvider<GitHubAuthProfile, 'github'> | null {
  if (!config.githubClientId || !config.githubClientSecret) {
    return null
  }

  return createRemixGitHubAuthProvider({
    clientId: config.githubClientId,
    clientSecret: config.githubClientSecret,
    redirectUri: new URL(routes.auth.github.callback.href(), origin),
  })
}

export function createXAuthProvider(
  origin: string,
  config: SocialLoginConfig,
): OAuthProvider<XAuthProfile, 'x'> | null {
  if (!config.xClientId || !config.xClientSecret) {
    return null
  }

  return createRemixXAuthProvider({
    clientId: config.xClientId,
    clientSecret: config.xClientSecret,
    redirectUri: new URL(routes.auth.x.callback.href(), origin),
  })
}

export function getProviderLabel(name: SocialProviderName): string {
  switch (name) {
    case 'google':
      return 'Google'
    case 'github':
      return 'GitHub'
    case 'x':
      return 'X'
  }
}

export function getProviderIconHref(name: SocialProviderName): string {
  switch (name) {
    case 'google':
      return '/icons/google.svg'
    case 'github':
      return '/icons/github.svg'
    case 'x':
      return '/icons/x.svg'
  }
}

export function getProviderLoginHref(name: SocialProviderName): string {
  switch (name) {
    case 'google':
      return routes.auth.google.login.href()
    case 'github':
      return routes.auth.github.login.href()
    case 'x':
      return routes.auth.x.login.href()
  }
}

export function getProviderCallbackHref(name: SocialProviderName, origin: string): string {
  switch (name) {
    case 'google':
      return `${origin}${routes.auth.google.callback.href()}`
    case 'github':
      return `${origin}${routes.auth.github.callback.href()}`
    case 'x':
      return `${origin}${routes.auth.x.callback.href()}`
  }
}

export function getProviderEnvVars(name: SocialProviderName): string[] {
  switch (name) {
    case 'google':
      return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
    case 'github':
      return ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']
    case 'x':
      return ['X_CLIENT_ID', 'X_CLIENT_SECRET']
  }
}

export function getProviderSetupHeading(name: SocialProviderName): string {
  switch (name) {
    case 'google':
      return 'Create a Google web OAuth client'
    case 'github':
      return 'Create a GitHub OAuth app'
    case 'x':
      return 'Create an X app'
  }
}

export function getSocialProviderStates(config: SocialLoginConfig): SocialProviderState[] {
  return socialProviderNames.map(name => getSocialProviderState(name, config))
}

export function getProviderUnavailableMessage(
  name: SocialProviderName,
  config: SocialLoginConfig,
): string {
  let missingEnv = getSocialProviderState(name, config).missingEnv

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

function getSocialProviderState(
  name: SocialProviderName,
  config: SocialLoginConfig,
): SocialProviderState {
  let missingEnv = getMissingProviderEnvVars(name, config)

  return {
    name,
    label: getProviderLabel(name),
    configured: missingEnv.length === 0,
    missingEnv,
  }
}

function getMissingProviderEnvVars(
  name: SocialProviderName,
  config: SocialLoginConfig,
): string[] {
  switch (name) {
    case 'google':
      return [
        ...readMissingEnv('GOOGLE_CLIENT_ID', config.googleClientId),
        ...readMissingEnv('GOOGLE_CLIENT_SECRET', config.googleClientSecret),
      ]
    case 'github':
      return [
        ...readMissingEnv('GITHUB_CLIENT_ID', config.githubClientId),
        ...readMissingEnv('GITHUB_CLIENT_SECRET', config.githubClientSecret),
      ]
    case 'x':
      return [
        ...readMissingEnv('X_CLIENT_ID', config.xClientId),
        ...readMissingEnv('X_CLIENT_SECRET', config.xClientSecret),
      ]
  }
}

function readMissingEnv(name: string, value: string | undefined): string[] {
  return value ? [] : [name]
}
