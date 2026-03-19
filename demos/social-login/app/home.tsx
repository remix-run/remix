import type { BuildAction } from 'remix/fetch-router'
import { css } from 'remix/component'

import type { routes } from './routes.ts'
import { render } from './render.tsx'

let pageStyles = css({
  margin: 0,
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  '& *': {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
  },
  '& button, & input, & textarea, & select': {
    font: 'inherit',
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    fontSize: 'inherit',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  '& .login-container': {
    width: '100%',
    maxWidth: '28rem',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  '& .login-header': {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  '& .login-header h1': {
    marginBottom: '0.5rem',
    fontSize: '1.875rem',
    fontWeight: 'inherit',
    color: '#111827',
  },
  '& .login-subtitle': {
    color: '#4b5563',
    fontSize: '1rem',
  },
  '& .login-form': {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  '& .form-group': {
    display: 'flex',
    flexDirection: 'column',
  },
  '& .form-label': {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    color: '#374151',
    fontWeight: 500,
  },
  '& .input-wrapper': {
    position: 'relative',
  },
  '& .input-icon': {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '1.25rem',
    height: '1.25rem',
    color: '#9ca3af',
  },
  '& .form-input': {
    width: '100%',
    padding: '0.5rem 1rem 0.5rem 2.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    outline: 'none',
    transition: 'all 0.2s',
    fontSize: '1rem',
  },
  '& .form-input:focus': {
    borderColor: 'transparent',
    boxShadow: '0 0 0 2px #3b82f6',
  },
  '& .form-options': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.875rem',
  },
  '& .remember-me': {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  '& .remember-me input': {
    marginRight: '0.5rem',
    cursor: 'pointer',
  },
  '& .remember-me span': {
    color: '#4b5563',
  },
  '& .forgot-password': {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.875rem',
  },
  '& .forgot-password:hover': {
    textDecoration: 'underline',
  },
  '& .submit-button': {
    width: '100%',
    padding: '0.625rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontSize: '1rem',
    fontWeight: 500,
  },
  '& .submit-button:hover': {
    backgroundColor: '#1d4ed8',
  },
  '& .divider': {
    margin: '1.5rem 0',
    display: 'flex',
    alignItems: 'center',
  },
  '& .divider-line': {
    flex: '1',
    borderTop: '1px solid #d1d5db',
  },
  '& .divider-text': {
    padding: '0 1rem',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  '& .social-buttons': {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  '& .social-button': {
    width: '100%',
    padding: '0.625rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    fontSize: '1rem',
  },
  '& .social-button:hover': {
    backgroundColor: '#f9fafb',
  },
  '& .social-icon': {
    width: '1.25rem',
    height: '1.25rem',
  },
  '& .social-button span': {
    color: '#374151',
    fontWeight: 500,
  },
  '& .signup-prompt': {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: '#4b5563',
  },
  '& .signup-link': {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.875rem',
  },
  '& .signup-link:hover': {
    textDecoration: 'underline',
  },
})

export let home: BuildAction<'GET', typeof routes.home> = {
  action() {
    return render(
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Login</title>
        </head>
        <body mix={[pageStyles]}>
          <div class="login-container">
            <div class="login-header">
              <h1>Welcome Back</h1>
              <p class="login-subtitle">Sign in to your account</p>
            </div>

            <form class="login-form" id="loginForm">
              <div class="form-group">
                <label htmlFor="email" class="form-label">
                  Email
                </label>
                <div class="input-wrapper">
                  <svg class="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    class="form-input"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label htmlFor="password" class="form-label">
                  Password
                </label>
                <div class="input-wrapper">
                  <svg class="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    class="form-input"
                    required
                  />
                </div>
              </div>

              <div class="form-options">
                <label class="remember-me">
                  <input type="checkbox" id="remember" />
                  <span>Remember me</span>
                </label>
                <button type="button" class="forgot-password">
                  Forgot password?
                </button>
              </div>

              <button type="submit" class="submit-button">
                Sign In
              </button>
            </form>

            <div class="divider">
              <div class="divider-line"></div>
              <span class="divider-text">or continue with</span>
              <div class="divider-line"></div>
            </div>

            <div class="social-buttons">
              <button class="social-button">
                <svg class="social-icon" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button class="social-button">
                <svg class="social-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </button>

              <button class="social-button">
                <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>X</span>
              </button>
            </div>

            <p class="signup-prompt">
              Don't have an account? <button class="signup-link">Sign up</button>
            </p>
          </div>
        </body>
      </html>,
    )
  },
}
