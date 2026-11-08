import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './controlled.example.tsx'
import { enterText, input, mount } from '../test-helpers.ts'

describe('Controlled toggle example', () => {
  it('changes password visibility without losing edited text', async (t) => {
    let result = await mount(t, <Example />)
    let password = input(result.container, 'input[type="password"]')
    let toggle = input(result.container, 'input[type="checkbox"]')
    await result.act(() => enterText(password, 'a-new-password'))
    await result.act(() => toggle.click())
    assert.equal(toggle.checked, true)
    assert.equal(password.type, 'text')
    assert.equal(password.value, 'a-new-password')
    await result.act(() => toggle.click())
    assert.equal(toggle.checked, false)
    assert.equal(password.type, 'password')
    assert.equal(password.value, 'a-new-password')
  })
})
