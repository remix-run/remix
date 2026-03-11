import { describe, it } from '../browser/test-framework.ts'
import * as assert from '../browser/assertions.ts'

describe('DOM Tests', () => {
  it('can interact with DOM', async () => {
    let div = document.createElement('div')
    div.textContent = 'Hello'
    assert.equal(div.textContent, 'Helloxxx')
  })

  it('can test fetch API', async () => {
    let response = await fetch('data:text/plain,hello')
    let text = await response.text()
    assert.equal(text, 'hello')
  })
})
