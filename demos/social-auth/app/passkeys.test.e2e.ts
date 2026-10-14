import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'
import { createPasskeyProvider } from './utils/passkey-auth.ts'

// Browsers reject IP addresses as relying party IDs, so the browser visits the test server through
// `localhost` and the passkey provider is configured for that origin.
async function servePasskeyDemo(t: TestContext, options: { autofill: boolean }) {
  let handler = (_request: Request): Promise<Response> => {
    throw new Error('Router is not ready')
  }
  let server = await createTestServer((request) => handler(request))
  let origin = server.baseUrl.replace('127.0.0.1', 'localhost')
  let router = await createTestRouter({ passkeyProvider: createPasskeyProvider(origin) })
  handler = router.fetch
  let page = await t.serve(server)

  if (!options.autofill) {
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false
    })
  }

  // A virtual authenticator with synced credentials stands in for a password manager. It approves
  // every prompt and answers autofill requests with its first passkey.
  let cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
      defaultBackupEligibility: true,
      defaultBackupState: true,
    },
  })

  return { page, origin }
}

async function signInWithPassword(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/`)
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.getByRole('heading', { name: 'Signed In' }).waitFor()
}

async function addPasskey(page: Page, name: string): Promise<void> {
  await page.getByLabel('Passkey name').fill(name)
  await page.getByRole('button', { name: 'Add a passkey' }).click()
  await page.getByText(`Added passkey "${name}".`).waitFor()
}

describe('passkeys', () => {
  it('manages passkeys and signs in with the passkey button', async (t) => {
    let { page, origin } = await servePasskeyDemo(t, { autofill: false })

    await signInWithPassword(page, origin)
    await addPasskey(page, 'Work laptop')
    await page.getByText('Synced · Added').waitFor()

    await page.getByLabel('New name for Work laptop').fill('Personal laptop')
    await page.getByRole('button', { name: 'Rename' }).click()
    await page.getByText('Renamed passkey to "Personal laptop".').waitFor()

    await page.getByRole('button', { name: 'Add a passkey' }).click()
    await page.getByText('This device already has a passkey for your account.').waitFor()

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
    await page.getByText('Authenticated with Passkey').waitFor()
    assert.equal(new URL(page.url()).pathname, '/account')
    await page.getByText(/Last used/).waitFor()

    await page.getByRole('button', { name: 'Remove Personal laptop' }).click()
    await page.getByText('Removed passkey "Personal laptop".').waitFor()

    await page.getByRole('button', { name: 'Logout' }).click()
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
    await page
      .getByText(
        'That passkey is no longer registered. Sign in another way, then add a new passkey.',
      )
      .waitFor()
  })

  it('signs in from passkey autofill on the login page', async (t) => {
    let { page, origin } = await servePasskeyDemo(t, { autofill: true })

    await signInWithPassword(page, origin)
    await addPasskey(page, 'Phone')
    await page.getByRole('button', { name: 'Logout' }).click()

    await page.getByText('Authenticated with Passkey').waitFor()
    assert.equal(new URL(page.url()).pathname, '/account')
  })

  it('explains where passkeys work when the demo is opened on an IP address', async (t) => {
    let { page, origin } = await servePasskeyDemo(t, { autofill: true })

    await page.goto('/')
    await page.getByText(`Open this page on ${new URL(origin).host}`).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Sign in with a passkey' }).count(), 0)
  })
})
