import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import type { Account } from '../../../data/account.ts'
import { accountConstraints, getAccount, updateAccount } from '../../../data/account.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { frames, routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'
import { AccountDocument, AccountEditor, type AccountFormErrors } from './account-page.tsx'

export default createController(routes.main.account, {
  middleware: [requireAuth],
  actions: {
    index({ render, request, url }) {
      let editor = <AccountEditor values={getAccount()} saved={url.searchParams.has('saved')} />
      if (isAccountFrameRequest(request)) return render(editor)

      return render(<AccountDocument frameSrc={request.url} />)
    },
    async action({ render, request }) {
      let values = readAccount(await request.formData())
      let errors = validateAccount(values)

      if (Object.keys(errors).length > 0) {
        let editor = <AccountEditor values={values} errors={errors} />
        if (isAccountFrameRequest(request)) {
          return render(editor, { status: 422 })
        }

        return render(
          <Layout title="Account" activeNav="account">
            {editor}
          </Layout>,
          { status: 422 },
        )
      }

      updateAccount(values)
      if (isAccountFrameRequest(request)) {
        return render(<AccountEditor values={values} saved />)
      }

      return redirect(`${routes.main.account.index.href()}?saved`, 303)
    },
  },
})

function isAccountFrameRequest(request: Request): boolean {
  return (
    request.headers.get('X-Remix-Frame') === 'true' &&
    request.headers.get('X-Remix-Target') === frames.account
  )
}

function readAccount(formData: FormData): Account {
  return {
    displayName: readString(formData, 'displayName'),
    program: readString(formData, 'program'),
    expectedGraduation: readString(formData, 'expectedGraduation'),
  }
}

function readString(formData: FormData, name: string): string {
  let value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function validateAccount(values: Account): AccountFormErrors {
  let errors: AccountFormErrors = {}

  if (!values.displayName) {
    errors.displayName = 'Enter a display name.'
  } else if (values.displayName.length > accountConstraints.displayName.maxLength) {
    errors.displayName = 'Display name is too long.'
  }

  if (!values.program) {
    errors.program = 'Enter a program.'
  } else if (values.program.length > accountConstraints.program.maxLength) {
    errors.program = 'Program is too long.'
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(values.expectedGraduation)) {
    errors.expectedGraduation = 'Choose an expected graduation month.'
  }

  return errors
}
