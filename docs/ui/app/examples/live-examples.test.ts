import { access, glob } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

const directory = fileURLToPath(new URL('.', import.meta.url))

describe('Live example coverage', () => {
  it('keeps a companion browser test beside every live example', async () => {
    let count = 0
    for await (let example of glob('**/*.example.tsx', { cwd: directory })) {
      count++
      let test = example.replace(/\.tsx$/, '.test.browser.tsx')
      await assert.doesNotReject(
        () => access(new URL(test, import.meta.url)),
        `Missing browser test for ${example}`,
      )
    }
    assert.ok(count > 0)
  })
})
