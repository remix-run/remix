import { createInstance } from 'i18next'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTranslator, resources } from './config.ts'

describe('translator resources', () => {
  it('reads typed catalog subtrees by key path', async () => {
    let instance = createInstance()
    await instance.init({ lng: 'en', resources })
    let t = createTranslator(instance, 'en')

    assert.equal(t.get('pluralization'), resources.en.translation.pluralization)
    assert.equal(t.get('pluralization.cart_demo.title'), 'Interactive cart')
  })
})
