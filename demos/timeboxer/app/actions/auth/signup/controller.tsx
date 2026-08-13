import { completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { Auth } from 'remix/middleware/auth'
import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { hashPassword } from '../../../data/passwords.ts'
import { userPasswords, users } from '../../../data/schema.ts'
import { databaseContext } from '../../../middleware/database.ts'
import { routes } from '../../../routes.ts'
import { render } from '../../../utils/render.tsx'
import { issuesToErrors } from '../form-errors.ts'
import { SignupPage } from '../pages.tsx'

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

export const authSignup = createController(routes.auth.signup, {
  actions: {
    async index(context) {
      let auth = context.get(Auth)

      if (auth.ok) {
        return redirect(routes.home.index.href())
      }

      return render(<SignupPage csrfToken={getCsrfToken(context)} />, context.request)
    },

    async action(context) {
      let parsed = s.parseSafe(signupSchema, context.get(FormData))

      if (!parsed.success) {
        return render(
          <SignupPage csrfToken={getCsrfToken(context)} errors={issuesToErrors(parsed.issues)} />,
          context.request,
          { status: 400 },
        )
      }

      let { username, password } = parsed.value
      let db = context.get(databaseContext)
      let existingUser = await db.findOne(users, { where: { username } })

      if (existingUser) {
        return render(
          <SignupPage
            csrfToken={getCsrfToken(context)}
            errors={{ username: 'That username is already taken.' }}
          />,
          context.request,
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
