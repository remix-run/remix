import { assert } from '@remix-run/assert'
import { describe, it } from '@remix-run/testing'

describe('DOM Tests', () => {
  it('can interact with DOM', async () => {
    let div = document.createElement('div')
    div.textContent = 'Hello'
    assert.equal(div.textContent, 'Hello')
  })

  it('can test fetch API', async () => {
    let response = await fetch('data:text/plain,hello')
    let text = await response.text()
    assert.equal(text, 'hello')
  })
})
