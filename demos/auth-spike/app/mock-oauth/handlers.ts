import type { RouteHandlers } from '@remix-run/fetch-router'
import type { routes } from '../routes.ts'

// Storage for customized profiles by access token
let customProfiles = new Map<
  string,
  {
    id: string
    email: string
    name?: string
    avatarUrl?: string
  }
>()

// Storage for authorization codes and their associated profiles
let authorizationCodes = new Map<
  string,
  {
    profile: {
      id: string
      email: string
      name?: string
      avatarUrl?: string
    }
    used: boolean
  }
>()

/**
 * Create mock OAuth server endpoints for local development and testing.
 *
 * In development mode (showUI: true), displays an interactive authorization
 * UI where you can customize the user profile.
 *
 * In test mode (showUI: false), auto-approves with the default profile,
 * or simulates errors if configured.
 */
export function createMockOAuthHandlers(options: {
  /**
   * Default user profile to return
   */
  profile: {
    id: string
    email: string
    name?: string
    avatarUrl?: string
  }
  /**
   * Whether to show authorization UI (true for dev, false for tests)
   */
  showUI: boolean
  /**
   * Whether to simulate authorization denial (test only)
   */
  denyAuthorization?: boolean
  /**
   * Custom error to return during authorization (test only)
   */
  authorizationError?: { error: string; error_description?: string }
  /**
   * Custom error to return during token exchange (test only)
   */
  tokenError?: { error: string; error_description?: string }
}) {
  let { profile, showUI, denyAuthorization, authorizationError, tokenError } = options

  return {
    authorize: {
      /**
       * Authorization endpoint (GET)
       * Shows UI or auto-redirects with code/error
       */
      index({ url }) {
        let redirectUri = url.searchParams.get('redirect_uri')
        let state = url.searchParams.get('state')
        let clientId = url.searchParams.get('client_id')

        if (!redirectUri || !state) {
          return new Response('Missing redirect_uri or state', { status: 400 })
        }

        // Auto-redirect without UI (for tests)
        if (!showUI) {
          let callbackUrl = new URL(redirectUri)

          // Simulate authorization denial
          if (denyAuthorization) {
            callbackUrl.searchParams.set('error', 'access_denied')
            callbackUrl.searchParams.set('error_description', 'User denied authorization')
            callbackUrl.searchParams.set('state', state)

            return new Response(null, {
              status: 302,
              headers: { Location: callbackUrl.toString() },
            })
          }

          // Simulate custom authorization error
          if (authorizationError) {
            callbackUrl.searchParams.set('error', authorizationError.error)
            if (authorizationError.error_description) {
              callbackUrl.searchParams.set(
                'error_description',
                authorizationError.error_description,
              )
            }
            callbackUrl.searchParams.set('state', state)

            return new Response(null, {
              status: 302,
              headers: { Location: callbackUrl.toString() },
            })
          }

          // Success - generate code
          let code = `mock_auth_code_${Date.now()}`

          authorizationCodes.set(code, {
            profile,
            used: false,
          })

          callbackUrl.searchParams.set('code', code)
          callbackUrl.searchParams.set('state', state)

          return new Response(null, {
            status: 302,
            headers: { Location: callbackUrl.toString() },
          })
        }

        // Show authorization UI
        let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mock OAuth Authorization</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 3rem 1rem 1rem 1rem;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 {
      color: #333;
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .app-info {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }
    .app-name {
      font-weight: 600;
      color: #667eea;
    }
    .field {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 0.5rem;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-approve {
      background: #667eea;
      color: white;
    }
    .btn-approve:hover {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn-deny {
      background: #fff;
      color: #c53030;
      border: 2px solid #fc8181;
    }
    .btn-deny:hover {
      background: #fff5f5;
      border-color: #f56565;
    }
    .scopes {
      background: #f7fafc;
      padding: 1rem;
      border-radius: 6px;
      margin: 1rem 0;
    }
    .scope {
      display: flex;
      align-items: center;
      padding: 0.5rem 0;
      color: #4a5568;
    }
    .scope::before {
      content: "✓";
      display: inline-block;
      width: 20px;
      height: 20px;
      background: #48bb78;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 20px;
      margin-right: 0.75rem;
      font-size: 0.75rem;
    }
    .section {
      background: #f7fafc;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
    }
    .section h2 {
      color: #2d3748;
      font-size: 1rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }
    .section-deny {
      background: #fff5f5;
      border-color: #feb2b2;
    }
    .section-deny h2 {
      color: #c53030;
    }
    select {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e2e8f0;
      border-radius: 6px;
      font-size: 1rem;
      background: white;
      cursor: pointer;
    }
    select:focus {
      outline: none;
      border-color: #667eea;
    }
    .divider {
      text-align: center;
      margin: 2rem 0;
      position: relative;
      color: #a0aec0;
      font-weight: 500;
      font-size: 0.875rem;
    }
    .divider::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      width: 100%;
      height: 1px;
      background: #e2e8f0;
      z-index: 0;
    }
    .divider span {
      background: white;
      padding: 0 1rem;
      position: relative;
      z-index: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Mock OAuth Authorization</h1>
    
    <div class="app-info">
      <div style="margin-bottom: 0.5rem; color: #718096;">
        <strong class="app-name">${clientId}</strong> wants to access your account
      </div>
    </div>

    <form method="POST">
      <input type="hidden" name="redirect_uri" value="${redirectUri}" />
      <input type="hidden" name="state" value="${state}" />
      
      <!-- Approve Section -->
      <div class="section">
        <h2>✅ Authorize Access</h2>
        
        <div class="field">
          <label for="id">User ID</label>
          <input type="text" id="id" name="id" value="${profile.id}" required />
        </div>
        
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" value="${profile.email}" required />
        </div>
        
        <div class="field">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" value="${profile.name || ''}" />
        </div>

        ${
          url.searchParams.get('scope')
            ? `
          <div class="scopes">
            <strong style="display: block; margin-bottom: 0.5rem; color: #2d3748;">Permissions:</strong>
            ${url.searchParams
              .get('scope')!
              .split(' ')
              .filter(Boolean)
              .map((scope: string) => `<div class="scope">${scope}</div>`)
              .join('')}
          </div>
        `
            : ''
        }

        <button type="submit" name="action" value="approve" class="btn-approve" style="width: 100%; margin-top: 1rem;">
          Authorize
        </button>
      </div>

      <div class="divider"><span>OR</span></div>

      <!-- Deny/Error Section -->
      <div class="section section-deny">
        <h2>❌ Deny or Simulate Error</h2>
        
        <div class="field">
          <label for="error_type">Error Type:</label>
          <select id="error_type" name="error_type">
            <option value="access_denied">User denies authorization</option>
            <option value="server_error">Server error</option>
            <option value="temporarily_unavailable">Service temporarily unavailable</option>
            <option value="invalid_scope">Invalid scope requested</option>
          </select>
        </div>

        <button type="submit" name="action" value="deny" class="btn-deny" style="width: 100%; margin-top: 1rem;">
          Deny / Simulate Error
        </button>
      </div>
    </form>
  </div>
</body>
</html>
`

        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      },

      /**
       * Authorization endpoint (POST)
       * Handles form submission for approval/denial
       */
      action({ formData }) {
        let action = formData.get('action')
        let redirectUri = formData.get('redirect_uri')
        let state = formData.get('state')

        if (!redirectUri || !state) {
          return new Response('Missing redirect_uri or state', { status: 400 })
        }

        let callbackUrl = new URL(redirectUri as string)

        // User denied authorization or simulated error
        if (action === 'deny') {
          let errorType = (formData.get('error_type') as string) || 'access_denied'
          let errorDescriptions: Record<string, string> = {
            access_denied: 'User denied authorization',
            server_error: 'The authorization server encountered an unexpected error',
            temporarily_unavailable: 'The authorization server is temporarily unavailable',
            invalid_scope: 'The requested scope is invalid or unsupported',
          }

          callbackUrl.searchParams.set('error', errorType)
          callbackUrl.searchParams.set(
            'error_description',
            errorDescriptions[errorType] || 'An error occurred',
          )
          callbackUrl.searchParams.set('state', state as string)

          return new Response(null, {
            status: 302,
            headers: { Location: callbackUrl.toString() },
          })
        }

        // User approved - customize profile if provided
        let customProfile = {
          id: (formData.get('id') as string) || profile.id,
          email: (formData.get('email') as string) || profile.email,
          name: (formData.get('name') as string) || profile.name,
          avatarUrl: profile.avatarUrl,
        }

        // Generate code and store customized profile
        let code = `mock_auth_code_${Date.now()}`
        let accessToken = `mock_access_token_${code}`

        // Store the customized profile keyed by access token
        customProfiles.set(accessToken, customProfile)

        authorizationCodes.set(code, {
          profile: customProfile,
          used: false,
        })

        callbackUrl.searchParams.set('code', code)
        callbackUrl.searchParams.set('state', state as string)

        return new Response(null, {
          status: 302,
          headers: { Location: callbackUrl.toString() },
        })
      },
    },

    /**
     * Token endpoint
     * POST /mock-oauth/token
     */
    async token({ formData }) {
      let code = formData.get('code') as string

      if (!code) {
        return new Response(
          JSON.stringify({
            error: 'invalid_request',
            error_description: 'Missing code parameter',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      let codeData = authorizationCodes.get(code)

      if (!codeData || codeData.used) {
        return new Response(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // Simulate token error
      if (tokenError) {
        return new Response(
          JSON.stringify({
            error: tokenError.error,
            error_description: tokenError.error_description || 'Token exchange failed',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // Mark code as used
      codeData.used = true

      // Generate tokens
      let accessToken = `mock_access_token_${code}`
      let refreshToken = `mock_refresh_token_${code}`

      // Store profile with access token for user endpoint
      customProfiles.set(accessToken, codeData.profile)

      return new Response(
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    },

    /**
     * User profile endpoint
     * GET /mock-oauth/user
     */
    user({ request }) {
      let authorization = request.headers.get('Authorization')

      if (!authorization || !authorization.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({
            error: 'invalid_token',
            error_description: 'Missing or invalid authorization header',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      let accessToken = authorization.slice(7) // Remove 'Bearer ' prefix
      let userProfile = customProfiles.get(accessToken)

      if (!userProfile) {
        return new Response(
          JSON.stringify({
            error: 'invalid_token',
            error_description: 'Invalid access token',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(JSON.stringify(userProfile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  } satisfies RouteHandlers<typeof routes.mockOAuth>
}
