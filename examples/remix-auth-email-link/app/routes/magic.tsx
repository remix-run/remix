import type { LoaderFunction } from 'remix'

import { authenticator, EMAIL_LINK } from '~/services/auth.server'

export const loader: LoaderFunction = ({ request }) => {
  return authenticator.authenticate(EMAIL_LINK, request, {
    successRedirect: '/me',
    failureRedirect: '/login',
  })
}
