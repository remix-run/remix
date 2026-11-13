// Adapted from ES Module Shims 2.8.4 test/base-href.js.
import { assert, importShim, suite, test } from './test-adapter.ts'

suite('Base href', () => {
  test(`should should resolve relative to base href`, async () => {
    window.onerror = () => {}
    let m = await importShim('./base-href-relative.js')
    assert.equal(m.default, 'base href relative')
  })

  test('should resolve import map relative to base href', async () => {
    window.onerror = () => {}
    let m = await importShim('base-href-bare')
    assert.equal(m.default, 'base href bare')
  })
})
