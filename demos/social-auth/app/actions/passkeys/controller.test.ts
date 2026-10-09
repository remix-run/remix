import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../../db.ts'
import { passkeys } from '../../data/schema.ts'
import {
  assertContains,
  createTestRouter,
  requestWithSession,
  signIn,
  testOrigin,
} from '../../../test/helpers.ts'

async function createPasskey(userId: number, id: string, name: string) {
  await db.create(passkeys, {
    id,
    user_id: userId,
    name,
    public_key: 'pQECAyYgASFYIA',
    counter: 0,
    transports: JSON.stringify(['internal', 'hybrid']),
    backup_eligible: true,
    backed_up: true,
    aaguid: '00000000-0000-0000-0000-000000000000',
    created_at: Date.UTC(2026, 0, 15),
  })
}

describe('passkeys controller', () => {
  it('requires a signed-in user to start passkey registration', async () => {
    let router = await createTestRouter()

    let response = await router.fetch(`${testOrigin}/account/passkeys/registration-options`, {
      method: 'POST',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')
  })

  it('starts registration for the signed-in account and excludes its passkeys', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)
    await createPasskey(2, 'existing-passkey', 'Laptop')
    await createPasskey(1, 'admin-passkey', 'Admin laptop')

    let response = await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys/registration-options`, sessionCookie, {
        method: 'POST',
      }),
    )
    let options = await response.json()

    assert.deepEqual(options.rp, { id: 'social-auth.test', name: 'Remix Social Auth Demo' })
    assert.deepEqual(options.user, { id: 'Mg', name: 'user@example.com', displayName: 'Demo User' })
    assert.deepEqual(options.excludeCredentials, [
      { id: 'existing-passkey', type: 'public-key', transports: ['internal', 'hybrid'] },
    ])
  })

  it('lists the signed-in account passkeys', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)
    await createPasskey(2, 'existing-passkey', 'Laptop')

    let response = await router.fetch(requestWithSession(`${testOrigin}/account`, sessionCookie))
    let html = await response.text()

    assertContains(html, 'Laptop')
    assertContains(html, 'Synced · Added Jan 15, 2026 · Never used')
    assertContains(html, 'Add a passkey')
  })

  it('renames a passkey owned by the signed-in user', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)
    await createPasskey(2, 'existing-passkey', 'Laptop')

    let response = await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys/existing-passkey/rename`, sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ name: '  Work laptop  ' }),
      }),
    )
    let accountHtml = await (
      await router.fetch(requestWithSession(`${testOrigin}/account`, sessionCookie))
    ).text()

    assert.equal(response.headers.get('Location'), '/account')
    assert.equal((await db.find(passkeys, 'existing-passkey'))?.name, 'Work laptop')
    assertContains(accountHtml, 'Renamed passkey to "Work laptop".')
  })

  it('rejects empty passkey names', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)
    await createPasskey(2, 'existing-passkey', 'Laptop')

    await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys/existing-passkey/rename`, sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ name: '   ' }),
      }),
    )

    assert.equal((await db.find(passkeys, 'existing-passkey'))?.name, 'Laptop')
  })

  it('removes a passkey owned by the signed-in user', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)
    await createPasskey(2, 'existing-passkey', 'Laptop')

    await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys/existing-passkey/remove`, sessionCookie, {
        method: 'POST',
      }),
    )

    assert.equal(await db.find(passkeys, 'existing-passkey'), null)
  })

  it('does not rename or remove passkeys owned by another account', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)
    await createPasskey(1, 'admin-passkey', 'Admin laptop')

    await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys/admin-passkey/rename`, sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ name: 'Mine now' }),
      }),
    )
    await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys/admin-passkey/remove`, sessionCookie, {
        method: 'POST',
      }),
    )
    let accountHtml = await (
      await router.fetch(requestWithSession(`${testOrigin}/account`, sessionCookie))
    ).text()

    assert.equal((await db.find(passkeys, 'admin-passkey'))?.name, 'Admin laptop')
    assertContains(accountHtml, 'That passkey no longer exists.')
  })

  it('reports registration responses that fail verification', async () => {
    let router = await createTestRouter()
    let sessionCookie = await signIn(router)

    let response = await router.fetch(
      requestWithSession(`${testOrigin}/account/passkeys`, sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ name: 'Laptop', response: '{}' }),
      }),
    )
    let accountHtml = await (
      await router.fetch(requestWithSession(`${testOrigin}/account`, sessionCookie))
    ).text()

    assert.equal(response.headers.get('Location'), '/account')
    assert.deepEqual(await db.findMany(passkeys), [])
    assertContains(accountHtml, 'We could not verify that passkey. Please try again.')
  })
})
