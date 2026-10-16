import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './rich-options.example.tsx'
import { element, enterText, input, key, mount, waitFor } from '../test-helpers.ts'

describe('Rich combobox example', () => {
  it('finds an airport by its visible name and commits its city label', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let value = input(result.container, 'input[type="hidden"]')
    assert.equal(
      element(
        result.container,
        `[id="${search.getAttribute('aria-describedby')}"]`,
      ).textContent?.trim(),
      'Search by city, airport name, or code.',
    )

    await result.act(() => {
      search.focus()
      enterText(search, 'logan international')
    })

    let boston = element(result.container, '[role="option"]:not([hidden])')
    assert.ok(boston.textContent?.includes('Boston (BOS)'))
    assert.equal(element(boston, 'mark').textContent, 'Logan International')

    await result.act(() => boston.click())
    await waitFor(() => assert.equal(search.value, 'Boston (BOS)'))
    assert.equal(value.value, 'BOS')
  })

  it('commits exact aliases on blur and preserves uncommitted matches on Escape', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let value = input(result.container, 'input[type="hidden"]')
    await result.act(() => {
      search.focus()
      enterText(search, 'massachusetts')
    })
    await result.act(() => search.blur())
    assert.equal(value.value, 'BOS')
    assert.equal(search.value, 'massachusetts')
    await result.act(() => {
      search.focus()
      enterText(search, 'Mass')
      search.blur()
    })
    assert.equal(search.value, '')
    assert.equal(value.value, '')
    await result.act(() => {
      search.focus()
      enterText(search, 'massachusetts')
    })
    await result.act(() => key(search, 'Escape'))
    assert.equal(search.value, 'massachusetts')
    assert.equal(value.value, '')
    assert.equal(search.getAttribute('aria-expanded'), 'false')
  })

  it('searches aliases and prevents choosing an unavailable airport', async (t) => {
    let result = await mount(t, <Example />)
    let search = input(result.container, '[role="combobox"]')
    let value = input(result.container, 'input[type="hidden"]')
    await result.act(() => {
      search.focus()
      enterText(search, 'EWR')
    })
    let unavailable = element(result.container, '[role="option"]:not([hidden])')
    assert.equal(unavailable.getAttribute('aria-disabled'), 'true')
    await result.act(() => unavailable.click())
    assert.equal(value.value, '')
    await result.act(() => enterText(search, 'ord'))
    let chicago = element(result.container, '[role="option"]:not([hidden])')
    assert.ok(chicago.textContent?.includes('Chicago (ORD)'))
    assert.equal(element(chicago, 'mark').textContent, 'ORD')
    await result.act(() => enterText(search, 'Massachusetts'))
    let boston = element(result.container, '[role="option"]:not([hidden])')
    assert.ok(boston.textContent?.includes('Boston (BOS)'))
    await result.act(() => boston.click())
    await waitFor(() => assert.equal(value.value, 'BOS'))
    await waitFor(() => assert.equal(search.value, 'Boston (BOS)'))
    await result.act(() => search.blur())
    assert.equal(value.value, 'BOS')
    assert.equal(search.value, 'Boston (BOS)')
  })
})
