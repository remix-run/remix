import { createController } from 'remix/router'

import { getAccount } from '../../../data/account.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { frames, routes } from '../../../routes.ts'
import { AccountDocument, AccountPage } from './account-page.tsx'

export default createController(routes.main.account, {
  middleware: [requireAuth],
  actions: {
    index({ render, request, url }) {
      let page = <AccountPage account={getAccount()} saved={url.searchParams.has('saved')} />
      if (isAccountFrameRequest(request)) return render(page)

      return render(<AccountDocument title="Account" frameSrc={request.url} />)
    },
  },
})

function isAccountFrameRequest(request: Request): boolean {
  return (
    request.headers.get('X-Remix-Frame') === 'true' &&
    request.headers.get('X-Remix-Target') === frames.account
  )
}
