import { completeAuth, verifyCredentials } from 'remix/auth'
import { Auth } from 'remix/middleware/auth'
import { getCsrfToken } from 'remix/middleware/csrf'
import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

import { hashPassword } from '../../data/passwords.ts'
import { userPasswords, users } from '../../data/schema.ts'
import { credentialsSchema, passwordProvider } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { AuthStatusPage, LoginPage, SignupPage, type AuthFormErrors } from './pages.tsx'

const signupSchema = f.object({
  username: f.field(
    s
      .defaulted(s.string(), '')
      .transform((value) => value.trim())
      .pipe(minLength(3), maxLength(32))
      .refine(
        (value) => /^[A-Za-z0-9_-]+$/.test(value),
        'Use only letters, numbers, underscores, and dashes.',
      ),
  ),
  password: f.field(s.defaulted(s.string(), '').pipe(minLength(8), maxLength(128))),
})

export const auth = createController(routes.auth, {
  actions: {
    async index(context) {
      let auth = context.get(Auth)

      if (auth.ok) {
        return context.render(
          <AuthStatusPage csrfToken={getCsrfToken(context)} username={auth.identity.username} />,
        )
      }

      return redirect(routes.auth.login.index.href())
    },

    logout(context) {
      let session = context.get(Session)
      session.unset('auth')
      session.regenerateId(true)

      return redirect(routes.auth.login.index.href(), 303)
    },
  },
})

export const authLogin = createController(routes.auth.login, {
  actions: {
    async index(context) {
      let auth = context.get(Auth)

      if (auth.ok) {
        return redirect(routes.home.index.href())
      }

      let session = context.get(Session)
      let error = session.get('auth:error')

      return context.render(
        <LoginPage csrfToken={getCsrfToken(context)} error={stringOrUndefined(error)} />,
      )
    },

    async action(context) {
      let parsed = s.parseSafe(credentialsSchema, context.get(FormData))

      if (!parsed.success) {
        return context.render(
          <LoginPage csrfToken={getCsrfToken(context)} errors={issuesToErrors(parsed.issues)} />,
          { status: 400 },
        )
      }

      let user = await verifyCredentials(passwordProvider, context)

      if (!user) {
        let session = context.get(Session)
        session.flash('auth:error', 'Invalid username or password.')
        return redirect(routes.auth.login.index.href(), 303)
      }

      let session = completeAuth(context)
      session.set('auth', { userId: user.id })

      return redirect(routes.home.index.href(), 303)
    },
  },
})

export const authSignup = createController(routes.auth.signup, {
  actions: {
    async index(context) {
      let auth = context.get(Auth)

      if (auth.ok) {
        return redirect(routes.home.index.href())
      }

      return context.render(<SignupPage csrfToken={getCsrfToken(context)} />)
    },

    async action(context) {
      let parsed = s.parseSafe(signupSchema, context.get(FormData))

      if (!parsed.success) {
        return context.render(
          <SignupPage csrfToken={getCsrfToken(context)} errors={issuesToErrors(parsed.issues)} />,
          { status: 400 },
        )
      }

      let { username, password } = parsed.value
      let db = context.get(Database)
      let existingUser = await db.findOne(users, { where: { username } })

      if (existingUser) {
        return context.render(
          <SignupPage
            csrfToken={getCsrfToken(context)}
            errors={{ username: 'That username is already taken.' }}
          />,
          { status: 409 },
        )
      }

      let now = Date.now()
      let passwordHash = await hashPassword(password)
      let user = await db.transaction(async (tx) => {
        let createdUser = await tx.create(users, { username, created_at: now }, { returnRow: true })

        await tx.create(userPasswords, {
          user_id: createdUser.id,
          password_hash: passwordHash,
          created_at: now,
          updated_at: now,
        })

        return createdUser
      })

      let session = completeAuth(context)
      session.set('auth', { userId: user.id })

      return redirect(routes.home.index.href(), 303)
    },
  },
})

function issuesToErrors(issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>) {
  return issues.reduce<AuthFormErrors>((errors, issue) => {
    let field = issue.path?.[0]

    if (field === 'username' || field === 'password') {
      errors[field] = issue.message
    } else {
      errors.form = issue.message
    }

    return errors
  }, {})
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
