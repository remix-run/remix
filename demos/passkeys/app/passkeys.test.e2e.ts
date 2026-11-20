import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { startTestServer } from '../test/helpers.ts'

// Chromium's virtual authenticator stands in for a platform authenticator such as Touch ID or
// Windows Hello. It creates real key pairs and signs real assertions, and approves every prompt.
async function addVirtualAuthenticator(page: Page): Promise<() => Promise<void>> {
  let cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  let { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })

  return async () => {
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId })
  }
}

async function signUp(page: Page, username: string): Promise<void> {
  await page.goto('/')
  let signUpForm = page.getByRole('region', { name: 'New here?' })
  await signUpForm.getByLabel('Username').fill(username)
  await signUpForm.getByRole('button', { name: 'Create account with a passkey' }).click()
  await page.getByRole('heading', { name: `Signed in as ${username}` }).waitFor()
}

describe('passkeys in the browser', () => {
  it('signs up, signs out, and signs back in from the username autofill', async (t) => {
    let page = await t.serve(await startTestServer())
    await addVirtualAuthenticator(page)

    await signUp(page, 'ada')
    assert.equal(new URL(page.url()).pathname, '/account')
    assert.equal(await page.getByRole('listitem').count(), 1)

    // The virtual authenticator answers the sign-in page's autofill request as soon as it starts,
    // as if the user picked the passkey from the username field's suggestions.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByText('Last used').waitFor()
    assert.equal(new URL(page.url()).pathname, '/account')
  })

  it('signs in with the button when the browser has no passkey autofill', async (t) => {
    let page = await t.serve(await startTestServer())
    await page.addInitScript(() => {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false
    })
    await addVirtualAuthenticator(page)

    await signUp(page, 'katherine')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByText('Use the button to choose a saved passkey.').waitFor()
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()

    await page.getByRole('heading', { name: 'Signed in as katherine' }).waitFor()
    assert.ok(await page.getByText('Last used').isVisible())
  })

  it('adds a passkey from another device and removes one', async (t) => {
    let page = await t.serve(await startTestServer())
    let removeFirstAuthenticator = await addVirtualAuthenticator(page)

    await signUp(page, 'grace')
    let addButton = page.getByRole('button', { name: 'Add a passkey' })

    // The account's passkey is excluded, so the same authenticator refuses to make another.
    await addButton.click()
    await page.getByRole('alert').getByText('already has a passkey').waitFor()

    await removeFirstAuthenticator()
    await addVirtualAuthenticator(page)
    await addButton.click()
    await page.getByRole('status').getByText('Passkey added.').waitFor()
    assert.equal(await page.getByRole('listitem').count(), 2)

    await page.getByRole('button', { name: 'Remove' }).first().click()
    await page.getByRole('status').getByText('Passkey removed.').waitFor()
    assert.equal(await page.getByRole('listitem').count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Remove' }).count(), 0)
  })
})
