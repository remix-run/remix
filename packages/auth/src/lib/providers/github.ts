import type { OAuthAccount, OAuthProvider, OAuthResult } from '../provider.ts'
import {
  createAuthorizationURL,
  createOAuthProvider,
  exchangeAuthorizationCode,
  fetchJson,
  getAuthorizationCode,
} from '../provider.ts'
import { createCodeChallenge } from '../utils.ts'

const GITHUB_AUTHORIZATION_ENDPOINT = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_ENDPOINT = 'https://api.github.com/user'
const GITHUB_USER_EMAILS_ENDPOINT = 'https://api.github.com/user/emails'
const DEFAULT_GITHUB_SCOPES = ['read:user', 'user:email']

/**
 * Options for creating the built-in GitHub auth provider.
 */
export interface GitHubOptions {
  clientId: string
  clientSecret: string
  redirectUri: string | URL
  scopes?: string[]
}

/**
 * Profile fields returned by the built-in GitHub auth provider.
 */
export interface GitHubProfile {
  id: number
  login: string
  name?: string | null
  email?: string | null
  avatar_url?: string
  html_url?: string
}

/**
 * Email records returned by GitHub's `/user/emails` endpoint.
 */
export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility?: string | null
}

/**
 * Creates a GitHub OAuth App provider.
 *
 * @param options GitHub OAuth client settings for your application.
 * @returns An OAuth provider that can be passed to `login()` and `callback()`.
 */
export function createGitHubAuthProvider(options: GitHubOptions): OAuthProvider<GitHubProfile, 'github'> {
  let scopes = options.scopes ?? DEFAULT_GITHUB_SCOPES

  return createOAuthProvider('github', {
    async createAuthorizationURL(transaction) {
      let challenge = await createCodeChallenge(transaction.codeVerifier)

      return createAuthorizationURL(GITHUB_AUTHORIZATION_ENDPOINT, {
        client_id: options.clientId,
        redirect_uri: toURLString(options.redirectUri),
        scope: scopes.join(' '),
        state: transaction.state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
    },
    async authenticate(context, transaction): Promise<OAuthResult<GitHubProfile, 'github'>> {
      let tokens = await exchangeAuthorizationCode({
        tokenEndpoint: GITHUB_TOKEN_ENDPOINT,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectUri: options.redirectUri,
        code: getAuthorizationCode(context),
        codeVerifier: transaction.codeVerifier,
        headers: {
          Accept: 'application/json',
        },
      })
      let profile = await fetchJson<GitHubProfile>(
        GITHUB_USER_ENDPOINT,
        {
          headers: createGitHubHeaders(tokens.accessToken),
        },
        'Failed to load GitHub profile.',
      )
      profile = validateGitHubProfile(profile)

      if (profile.email == null) {
        let emails = await fetchJson<GitHubEmail[]>(
          GITHUB_USER_EMAILS_ENDPOINT,
          {
            headers: createGitHubHeaders(tokens.accessToken),
          },
          'Failed to load GitHub email addresses.',
        )
        let email = pickGitHubEmail(emails)
        if (email != null) {
          profile = { ...profile, email }
        }
      }

      return {
        provider: 'github',
        account: createAccount('github', String(profile.id)),
        profile,
        tokens,
      }
    },
  })
}

function createAccount(provider: 'github', providerAccountId: string): OAuthAccount<'github'> {
  return { provider, providerAccountId }
}

function createGitHubHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'remix-auth',
  }
}

function pickGitHubEmail(emails: GitHubEmail[]): string | undefined {
  let primaryVerified = emails.find(email => email.primary && email.verified)
  if (primaryVerified != null) {
    return primaryVerified.email
  }

  let verified = emails.find(email => email.verified)
  if (verified != null) {
    return verified.email
  }

  return emails[0]?.email
}

function validateGitHubProfile(profile: GitHubProfile): GitHubProfile {
  if (!Number.isInteger(profile.id)) {
    throw new Error('GitHub profile did not include a valid id.')
  }

  return profile
}

function toURLString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString()
}
