import { css } from 'remix/component'
import type { BuildAction } from 'remix/fetch-router'

import { EmailIcon, GitHubIcon, GoogleIcon, PasswordIcon, XIcon } from './components/icons.tsx'
import { designSystem } from './design-system.ts'
import type { routes } from './routes.ts'
import * as styles from './styles.ts'
import { render } from './utils/render.tsx'

let { tokens, theme } = designSystem

export let home: BuildAction<'GET', typeof routes.home> = {
  action() {
    return render(
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Login</title>
        </head>
        <body mix={[styles.pageReset, styles.page]}>
          <div mix={styles.card}>
            <div
              mix={css({
                marginBottom: tokens.space.xxl,
                textAlign: 'center',
              })}
            >
              <h1 mix={styles.heading}>Welcome Back</h1>
              <p
                mix={css({
                  color: theme.text.body,
                  fontSize: tokens.typography.size.md,
                })}
              >
                Sign in to your account
              </p>
            </div>

            <form id="loginForm" mix={styles.form}>
              <div
                mix={css({
                  display: 'flex',
                  flexDirection: 'column',
                })}
              >
                <label htmlFor="email" mix={styles.fieldLabel}>
                  Email
                </label>
                <div mix={css({ position: 'relative' })}>
                  <EmailIcon mix={styles.fieldIcon} />
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                    mix={styles.fieldInput}
                  />
                </div>
              </div>

              <div mix={css({ display: 'flex', flexDirection: 'column' })}>
                <label htmlFor="password" mix={styles.fieldLabel}>
                  Password
                </label>
                <div mix={css({ position: 'relative' })}>
                  <PasswordIcon mix={styles.fieldIcon} />
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    mix={styles.fieldInput}
                  />
                </div>
              </div>

              <div mix={styles.formOptions}>
                <label mix={styles.rememberMe}>
                  <input type="checkbox" id="remember" mix={styles.rememberCheckbox} />
                  <span mix={css({ color: theme.text.body })}>Remember me</span>
                </label>
                <button type="button" mix={styles.helperLink}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" mix={styles.submitButton}>
                Sign In
              </button>
            </form>

            <div mix={styles.divider}>
              <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
              <span mix={styles.dividerText}>or continue with</span>
              <div mix={css({ flex: '1', borderTop: theme.border.subtle })}></div>
            </div>

            <div mix={styles.socialButtons}>
              <button mix={styles.socialButton}>
                <GoogleIcon mix={styles.socialIcon} />
                <span
                  mix={css({
                    color: theme.text.label,
                    fontWeight: tokens.typography.weight.medium,
                  })}
                >
                  Google
                </span>
              </button>

              <button mix={styles.socialButton}>
                <GitHubIcon mix={styles.socialIcon} />
                <span
                  mix={css({
                    color: theme.text.label,
                    fontWeight: tokens.typography.weight.medium,
                  })}
                >
                  GitHub
                </span>
              </button>

              <button mix={styles.socialButton}>
                <XIcon mix={styles.socialIcon} />
                <span
                  mix={css({
                    color: theme.text.label,
                    fontWeight: tokens.typography.weight.medium,
                  })}
                >
                  X
                </span>
              </button>
            </div>

            <p
              mix={css({
                marginTop: tokens.space.xl,
                textAlign: 'center',
                fontSize: tokens.typography.size.sm,
                color: theme.text.body,
              })}
            >
              Don't have an account? <button mix={styles.helperLink}>Sign up</button>
            </p>
          </div>
        </body>
      </html>,
    )
  },
}
