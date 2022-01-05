import type { ActionFunction, LoaderFunction } from 'remix'
import { useLoaderData, json } from 'remix'

import { authenticator, EMAIL_LINK } from '~/services/auth.server'
import { getSession } from '~/services/session.server'

type LoaderData = {
  magicLinkSent: boolean
}

export const loader: LoaderFunction = async ({ request }) => {
  await authenticator.isAuthenticated(request, {
    successRedirect: '/dashboard',
  })
  const session = await getSession(request)
  const loaderData: LoaderData = {
    magicLinkSent: session.has('auth:magiclink'),
  }
  return json<LoaderData>(loaderData)
}

export const action: ActionFunction = async ({ request }) => {
  await authenticator.authenticate(EMAIL_LINK, request, {
    successRedirect: '/login',
    failureRedirect: '/login',
  })
}

export default function LoginPage(): JSX.Element {
  const { magicLinkSent } = useLoaderData<LoaderData>()
  return (
    <>
      {magicLinkSent && 'Sent the verification email!'}
      <form method="post">
        <input type="text" name="email" id="email" />
        <button type="submit">Login</button>
      </form>
    </>
  )
}
