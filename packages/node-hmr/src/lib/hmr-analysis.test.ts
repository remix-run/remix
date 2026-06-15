import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as nodeAssert from 'node:assert/strict'

import { analyzeNodeHmrSource } from './hmr-analysis.ts'
import type { NodeHmrAnalysis } from './hmr-analysis.ts'

describe('analyzeNodeHmrSource', () => {
  it('detects self-accepting modules from accept calls with no arguments', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/message.ts',
      [`if (import.meta.hot) {`, `  import.meta.hot.accept()`, `}`].join('\n'),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: true,
      usesImportMetaHot: true,
    })
  })

  it('detects self-accepting modules from accept calls with a callback', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/message.ts',
      [
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept((module) => {`,
        `    void module`,
        `  })`,
        `}`,
      ].join('\n'),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: true,
      usesImportMetaHot: true,
    })
  })

  it('detects self-accepting modules from accept calls with undefined', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/message.ts',
      [`if (import.meta.hot) {`, `  import.meta.hot.accept(undefined)`, `}`].join('\n'),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: true,
      usesImportMetaHot: true,
    })
  })

  it('detects accepted dependencies from real accept calls', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/routes/root.ts',
      [
        `if (import.meta.hot) {`,
        `  import.meta.hot.accept('./message.ts', () => {})`,
        `  import.meta.hot.accept(['./one.ts', '../two.ts'], () => {})`,
        `}`,
      ].join('\n'),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: ['./message.ts', './one.ts', '../two.ts'],
      selfAccepting: false,
      usesImportMetaHot: true,
    })
  })

  it('detects bare accepted dependencies from real accept calls', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/routes/root.ts',
      [`if (import.meta.hot) {`, `  import.meta.hot.accept('fixture-package', () => {})`, `}`].join(
        '\n',
      ),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: ['fixture-package'],
      selfAccepting: false,
      usesImportMetaHot: true,
    })
  })

  it('detects self-accepting modules from optional chaining accept calls', () => {
    let analysis = analyzeNodeHmrSource('file:///app/message.ts', `import.meta.hot?.accept()`)

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: true,
      usesImportMetaHot: true,
    })
  })

  it('detects accepted dependencies from optional chaining accept calls', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/message.ts',
      `import.meta.hot?.accept('./dep.ts', () => {})`,
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: ['./dep.ts'],
      selfAccepting: false,
      usesImportMetaHot: true,
    })
  })

  it('ignores comments and strings that mention the hot API', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/message.ts',
      [
        `// import.meta.hot.accept()`,
        `const text = "import.meta.hot.accept('./dep.ts')"`,
        `export const message = 'hello'`,
      ].join('\n'),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: false,
      usesImportMetaHot: false,
    })
  })

  it('skips parsing source that does not mention the hot API', () => {
    let analysis = analyzeNodeHmrSource('file:///app/message.ts', `export function broken( {`)

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: false,
      usesImportMetaHot: false,
    })
  })

  it('fails closed when source cannot be parsed', () => {
    let analysis = analyzeNodeHmrSource(
      'file:///app/message.ts',
      [`const hot = "import.meta.hot"`, `export function broken( {`].join('\n'),
    )

    assert.deepEqual(toComparableAnalysis(analysis), {
      acceptedDeps: [],
      selfAccepting: false,
      usesImportMetaHot: false,
    })
  })

  it('throws when an accepted dependency is not statically analyzable', () => {
    nodeAssert.throws(
      () =>
        analyzeNodeHmrSource(
          'file:///app/message.ts',
          [`let dep = './dep.ts'`, `import.meta.hot.accept(dep, () => {})`].join('\n'),
        ),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })

  it('throws when the first accept argument is an unsupported literal', () => {
    nodeAssert.throws(
      () => analyzeNodeHmrSource('file:///app/message.ts', `import.meta.hot.accept(123)`),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })

  it('throws when the first accept argument is null', () => {
    nodeAssert.throws(
      () => analyzeNodeHmrSource('file:///app/message.ts', `import.meta.hot.accept(null)`),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })

  it('throws when the first accept argument is an object', () => {
    nodeAssert.throws(
      () => analyzeNodeHmrSource('file:///app/message.ts', `import.meta.hot.accept({})`),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })

  it('throws when an accepted dependency array is not statically analyzable', () => {
    nodeAssert.throws(
      () =>
        analyzeNodeHmrSource(
          'file:///app/message.ts',
          [`let dep = './dep.ts'`, `import.meta.hot.accept(['./one.ts', dep], () => {})`].join(
            '\n',
          ),
        ),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })

  it('throws when an accepted dependency array contains a non-string item', () => {
    nodeAssert.throws(
      () =>
        analyzeNodeHmrSource(
          'file:///app/message.ts',
          `import.meta.hot.accept(['./one.ts', 123], () => {})`,
        ),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })

  it('throws when an accepted dependency array contains a spread element', () => {
    nodeAssert.throws(
      () =>
        analyzeNodeHmrSource(
          'file:///app/message.ts',
          `import.meta.hot.accept(['./one.ts', ...deps], () => {})`,
        ),
      /import\.meta\.hot\.accept\(\) can only accept/,
    )
  })
})

function toComparableAnalysis(analysis: NodeHmrAnalysis) {
  return {
    acceptedDeps: analysis.acceptedDeps.map((acceptedDep) => acceptedDep.specifier),
    selfAccepting: analysis.selfAccepting,
    usesImportMetaHot: analysis.usesImportMetaHot,
  }
}
