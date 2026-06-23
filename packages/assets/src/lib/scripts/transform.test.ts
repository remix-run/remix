import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createHmrClientSource } from '../hmr.ts'
import { getHmrAnalysis } from './transform.ts'

describe('getHmrAnalysis', () => {
  it('ignores comments and strings that mention import.meta.hot', () => {
    assert.deepEqual(
      getHmrAnalysis(
        [
          `// import.meta.hot.accept()`,
          `const text = "import.meta.hot.accept('./dep.ts')"`,
          `export const value = 1`,
        ].join('\n'),
      ),
      {
        acceptedDeps: [],
        selfAccepting: false,
        usesImportMetaHot: false,
      },
    )
  })

  it('detects real import.meta.hot usage', () => {
    assert.deepEqual(getHmrAnalysis(`import.meta.hot?.accept()`), {
      acceptedDeps: [],
      selfAccepting: true,
      usesImportMetaHot: true,
    })
  })

  it('throws when transformed code mentions import.meta.hot but cannot be parsed', () => {
    assert.throws(
      () => getHmrAnalysis(`if (import.meta.hot) { import.meta.hot.accept(() => {})`),
      /Failed to analyze HMR usage in transformed script/,
    )
  })
})

describe('createHmrClientSource', () => {
  it('awaits async dispose and accept callbacks during JavaScript updates', () => {
    let source = createHmrClientSource({ eventPathname: '/__hmr' })

    assert.match(source, /await callback\(previousContext\.data\)/)
    assert.match(source, /await callback\(updatedModule\)/)
    assert.match(source, /await callback\(acceptedContext\.data\)/)
    assert.match(source, /await callback\(deps\.map\(\(dep\) =>/)
  })
})
