import type { OAuthProvider, OAuthProviderConfig } from '../index.ts'

/**
 * GitHub OAuth Provider
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */
let githubProvider: OAuthProvider = {
  name: 'github',
  displayName: 'GitHub',

  getAuthorizationUrl({ clientId, redirectUri, state, scopes = ['user:email'] }) {
    let url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('scope', scopes.join(' '))
    return url.toString()
  },

  async exchangeCodeForToken({ clientId, clientSecret, code, redirectUri }) {
    let response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.statusText}`)
    }

    let data = await response.json()

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  },

  async getUserProfile(accessToken) {
    // Fetch user profile
    let userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!userResponse.ok) {
      throw new Error(`GitHub user fetch failed: ${userResponse.statusText}`)
    }

    let user = await userResponse.json()

    // Fetch primary email if not public
    let email = user.email
    if (!email) {
      let emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (emailsResponse.ok) {
        let emails = await emailsResponse.json()
        let primaryEmail = emails.find((e: any) => e.primary)
        email = primaryEmail?.email || emails[0]?.email
      }
    }

    if (!email) {
      throw new Error('GitHub user has no email address')
    }

    return {
      id: user.id.toString(),
      email,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
    }
  },
}

/**
 * Create a GitHub OAuth provider configuration
 *
 * @example
 * ```ts
 * let authClient = createAuthClient({
 *   oauth: {
 *     github: createGitHubOAuthProvider({
 *       clientId: process.env.GITHUB_CLIENT_ID,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET,
 *       scopes: ['user:email'],
 *     }),
 *   },
 * })
 * ```
 */
export function createGitHubOAuthProvider(options: {
  clientId?: string
  clientSecret?: string
  scopes?: string[]
}): OAuthProviderConfig {
  return {
    provider: githubProvider,
    clientId: options.clientId ?? process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: options.clientSecret ?? process.env.GITHUB_CLIENT_SECRET ?? '',
    scopes: options.scopes ?? ['user:email'],
  }
}
