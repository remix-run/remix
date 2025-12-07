import type { RequestHandler } from '@remix-run/fetch-router'
import { authClient } from './utils/auth.ts'
import { render } from './utils/render.tsx'
import { Layout } from './layout.tsx'
import { routes } from './routes.ts'
import { createRedirectResponse as redirect } from '@remix-run/response/redirect'

export default (async function verifyEmail({ url, session }) {
  let token = url.searchParams.get('token')

  if (!token) {
    return redirect(routes.auth.login.index.href())
  }

  let result = await authClient.emailVerification.verify({ session, token })

  if ('error' in result) {
    let errorMessage =
      result.error === 'invalid_or_expired_token'
        ? 'Invalid or expired verification link. Please request a new one.'
        : 'An error occurred during email verification.'

    session.flash('error', errorMessage)
    return redirect(routes.auth.login.index.href())
  }

  session.flash('success', 'Your email has been verified!')
  return redirect(routes.home.href())
}) satisfies RequestHandler

