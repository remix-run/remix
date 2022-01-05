import type { ActionFunction, LoaderFunction } from 'remix'
import { json, redirect } from 'remix'

import { destroySession, getSession } from '~/services/session.server'

export const action: ActionFunction = async ({ request }) => {
  return redirect('/', {
    headers: {
      'Set-Cookie': await destroySession(await getSession(request)),
    },
  })
}

export const loader: LoaderFunction = () => {
  throw json({}, { status: 404 })
}
