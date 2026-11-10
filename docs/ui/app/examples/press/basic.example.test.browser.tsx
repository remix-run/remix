import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, input, mount } from '../test-helpers.ts'

function press(target: HTMLElement) {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      isPrimary: true,
      pointerType: 'mouse',
    }),
  )
}

describe('Press example', () => {
  it('toggles, selects, submits and resets on mouse press, once', async (t) => {
    let result = await mount(t, <Example />)
    let form = element(result.container, 'form') as HTMLFormElement
    let digest = input(result.container, 'input[name="digest"]')
    let weekly = input(result.container, 'input[value="weekly"]')
    let changes = 0
    let submits = 0
    form.addEventListener('change', () => changes++)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submits++
    })

    await result.act(() => press(element(result.container, 'label')))
    assert.equal(digest.checked, false)
    await result.act(() => press(weekly.closest('label')!))
    assert.equal(weekly.checked, true)
    assert.equal(changes, 2)

    await result.act(() => press(button(result.container, 'Save')))
    assert.equal(submits, 1)

    await result.act(() => press(button(result.container, 'Reset')))
    assert.equal(digest.checked, true)
    assert.equal(weekly.checked, false)
  })

  it('still works from the keyboard and assistive technology clicks', async (t) => {
    let result = await mount(t, <Example />)
    let digest = input(result.container, 'input[name="digest"]')

    await result.act(() => digest.click())
    assert.equal(digest.checked, false)
  })
})
