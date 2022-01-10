import type { ActionFunction, LoaderFunction } from 'remix';
import { Form, useLoaderData, json } from 'remix'

import { authenticator, EMAIL_LINK } from '~/services/auth.server'
import { getSession } from '~/services/session.server'

type LoaderData = {
  magicLinkSent: boolean
}

export const loader: LoaderFunction = async ({ request }) => {
  // If the user is already logged in, redirect to /me
  await authenticator.isAuthenticated(request, {
    successRedirect: '/me',
  })
  const session = await getSession(request)
  // If the magic link is sent to the email, auth:magiclink will be present in session
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
      <Form method="post">
        <input type="text" name="email" id="email" />
        <button type="submit">Login</button>
      </Form>
    </>
  )
}
