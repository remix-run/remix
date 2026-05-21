import { css, type Handle, type RemixNode } from 'remix/ui'
import { Button } from 'remix/ui/button'
import { theme } from 'remix/ui/theme'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export type AuthFormErrors = {
  form?: string
  password?: string
  username?: string
}

type AuthStatusPageProps = {
  csrfToken: string
  username: string
}

export function AuthStatusPage(handle: Handle<AuthStatusPageProps>) {
  return () => {
    let { csrfToken, username } = handle.props

    return (
      <Layout title="Account">
        <section mix={pageStyle}>
          <div mix={cardStyle}>
            <p mix={eyebrowStyle}>Signed in</p>
            <h1 mix={titleStyle}>Welcome back, {username}.</h1>
            <p mix={bodyStyle}>Your session is active and backed by the local SQLite user record.</p>
            <LogoutForm csrfToken={csrfToken} />
          </div>
        </section>
      </Layout>
    )
  }
}

type LoginPageProps = {
  csrfToken: string
  error?: string
  errors?: AuthFormErrors
}

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    let { csrfToken, error, errors } = handle.props

    return (
      <Layout title="Sign in">
        <AuthShell
          eyebrow="Welcome back"
          title="Sign in to Timeboxer"
          description="Use your username and password to continue."
        >
          <AuthForm
            action={routes.auth.login.action.href()}
            csrfToken={csrfToken}
            submitLabel="Sign in"
            error={error ?? errors?.form}
            errors={errors}
          />
          <p mix={footerTextStyle}>
            Need an account? <a href={routes.auth.signup.index.href()}>Create one</a>.
          </p>
        </AuthShell>
      </Layout>
    )
  }
}

type SignupPageProps = {
  csrfToken: string
  errors?: AuthFormErrors
}

export function SignupPage(handle: Handle<SignupPageProps>) {
  return () => {
    let { csrfToken, errors } = handle.props

    return (
      <Layout title="Create account">
        <AuthShell
          eyebrow="Get started"
          title="Create your account"
          description="Pick a username and password. Passwords are stored separately from user profiles."
        >
          <AuthForm
            action={routes.auth.signup.action.href()}
            csrfToken={csrfToken}
            submitLabel="Create account"
            errors={errors}
          />
          <p mix={footerTextStyle}>
            Already have an account? <a href={routes.auth.login.index.href()}>Sign in</a>.
          </p>
        </AuthShell>
      </Layout>
    )
  }
}

type AuthShellProps = {
  children?: RemixNode
  description: string
  eyebrow: string
  title: string
}

function AuthShell(handle: Handle<AuthShellProps>) {
  return () => {
    let { children, description, eyebrow, title } = handle.props

    return (
      <section mix={pageStyle}>
        <div mix={cardStyle}>
          <p mix={eyebrowStyle}>{eyebrow}</p>
          <h1 mix={titleStyle}>{title}</h1>
          <p mix={bodyStyle}>{description}</p>
          {children}
        </div>
      </section>
    )
  }
}

type AuthFormProps = {
  action: string
  csrfToken: string
  error?: string
  errors?: AuthFormErrors
  submitLabel: string
}

function AuthForm(handle: Handle<AuthFormProps>) {
  return () => {
    let { action, csrfToken, error, errors, submitLabel } = handle.props

    return (
      <form action={action} method="post" mix={formStyle}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        {error ? (
          <p role="alert" mix={errorStyle}>
            {error}
          </p>
        ) : null}
        <label mix={fieldStyle}>
          <span>Username</span>
          <input
            aria-describedby={errors?.username ? 'username-error' : undefined}
            aria-invalid={errors?.username ? true : undefined}
            autoComplete="username"
            maxLength={32}
            minLength={3}
            name="username"
            required
            type="text"
            mix={inputStyle}
          />
          {errors?.username ? (
            <small id="username-error" mix={fieldErrorStyle}>
              {errors.username}
            </small>
          ) : null}
        </label>
        <label mix={fieldStyle}>
          <span>Password</span>
          <input
            aria-describedby={errors?.password ? 'password-error' : undefined}
            aria-invalid={errors?.password ? true : undefined}
            autoComplete="current-password"
            maxLength={128}
            minLength={8}
            name="password"
            required
            type="password"
            mix={inputStyle}
          />
          {errors?.password ? (
            <small id="password-error" mix={fieldErrorStyle}>
              {errors.password}
            </small>
          ) : null}
        </label>
        <Button type="submit" tone="primary">
          {submitLabel}
        </Button>
      </form>
    )
  }
}

function LogoutForm(handle: Handle<{ csrfToken: string }>) {
  return () => {
    let { csrfToken } = handle.props

    return (
      <form action={routes.auth.logout.href()} method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <Button type="submit" tone="secondary">
          Sign out
        </Button>
      </form>
    )
  }
}

const pageStyle = css({
  display: 'grid',
  minHeight: 'calc(100vh - 80px)',
  placeItems: 'center',
  padding: theme.space.xl,
})

const cardStyle = css({
  width: 'min(100%, 420px)',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.surface.lvl1,
  boxShadow: theme.shadow.lg,
  padding: theme.space.xl,
})

const eyebrowStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.wide,
  margin: '0 0 0.5rem',
  textTransform: 'uppercase',
})

const titleStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xxl,
  letterSpacing: theme.letterSpacing.tight,
  lineHeight: theme.lineHeight.tight,
  margin: 0,
})

const bodyStyle = css({
  color: theme.colors.text.secondary,
  lineHeight: theme.lineHeight.relaxed,
  margin: `${theme.space.sm} 0 ${theme.space.lg}`,
})

const formStyle = css({
  display: 'grid',
  gap: theme.space.md,
})

const fieldStyle = css({
  color: theme.colors.text.secondary,
  display: 'grid',
  fontSize: theme.fontSize.sm,
  gap: theme.space.xs,
})

const inputStyle = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  boxSizing: 'border-box',
  color: theme.colors.text.primary,
  font: 'inherit',
  minHeight: theme.control.height.md,
  padding: `${theme.space.sm} ${theme.space.md}`,
  width: '100%',
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const errorStyle = css({
  backgroundColor: theme.colors.action.danger.background,
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.foreground,
  margin: 0,
  padding: theme.space.md,
})

const fieldErrorStyle = css({
  color: theme.colors.action.danger.background,
})

const footerTextStyle = css({
  color: theme.colors.text.secondary,
  margin: `${theme.space.lg} 0 0`,
})
