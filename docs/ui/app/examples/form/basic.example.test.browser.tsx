import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, enterText, input, mount, waitFor } from '../test-helpers.ts'

describe('Form basic example', () => {
  it('shows field feedback after blur and accepts corrected details', async (t) => {
    let result = await mount(t, <Example />)
    let name = input(result.container, 'input[name="name"]')
    let email = input(result.container, 'input[name="email"]')
    let nameError = element(result.container, '[id$="-error-name"]')
    let emailError = element(result.container, '[id$="-error-email"]')

    assert.equal(
      result.container.querySelector('label[for="' + name.id + '"]')?.textContent,
      'Name',
    )
    assert.equal(nameError.textContent, '')

    await result.act(() => {
      enterText(name, 'A')
      name.focus()
      name.blur()
    })
    await waitFor(() => assert.ok(nameError.textContent?.trim()))
    assert.equal(name.getAttribute('aria-invalid'), 'true')
    assert.ok(name.getAttribute('aria-describedby')?.includes(nameError.id))

    await result.act(() => {
      enterText(name, 'Ada')
      enterText(email, 'not-an-email')
      email.focus()
      email.blur()
    })
    await waitFor(() => assert.equal(nameError.textContent, ''))
    await waitFor(() => assert.ok(emailError.textContent?.trim()))
    assert.equal(email.getAttribute('aria-invalid'), 'true')

    await result.act(() => enterText(email, 'ada@example.com'))
    await waitFor(() => assert.equal(emailError.textContent, ''))
    await result.act(() => button(result.container, 'Check details').click())
    await waitFor(() =>
      assert.equal(element(result.container, '[role="status"]').textContent, 'Details are valid'),
    )
  })
})
