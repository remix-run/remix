import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  loginAsAdmin,
  requestWithSession,
} from '../../../../test/helpers.ts'

const router = await createTestRouter()

describe('admin users handlers', () => {
  it('PUT /admin/users/:userId restores submitted values after validation fails', async () => {
    let sessionId = await loginAsAdmin(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/admin/users/2', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({
          name: 'Changed Name',
          email: 'changed@example.com',
          role: 'invalid',
        }),
      }),
    )

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Changed Name"')
    assertContains(html, 'value="changed@example.com"')
    assertContains(html, 'aria-invalid="true"')
  })
})
