import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  getPackageExportSideEffects,
  getSideEffectPatternPairingIssues,
} from './package-side-effects.ts'

describe('getPackageExportSideEffects', () => {
  it('treats missing sideEffects metadata as side-effectful', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { '.': './src/index.ts' },
          publishConfig: { exports: { '.': './dist/index.js' } },
        },
        '.',
      ),
      { published: true, source: true },
    )
  })

  it('treats missing export configuration as side-effectful', () => {
    assert.deepEqual(getPackageExportSideEffects({ exports: {} }, './missing'), {
      published: true,
      source: true,
    })
  })

  it('treats sideEffects false as side-effect-free', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { '.': './src/index.ts' },
          publishConfig: { exports: { '.': './dist/index.js' } },
          sideEffects: false,
        },
        '.',
      ),
      { published: false, source: false },
    )
  })

  it('matches source and published targets independently', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { '.': './src/index.ts' },
          publishConfig: { exports: { '.': './dist/index.js' } },
          sideEffects: ['./src/index.ts'],
        },
        '.',
      ),
      { published: false, source: true },
    )
  })

  it('matches basename-only glob patterns at any depth', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { './register': './src/runtime/register.ts' },
          publishConfig: { exports: { './register': './dist/runtime/register.js' } },
          sideEffects: ['register.*'],
        },
        './register',
      ),
      { published: true, source: true },
    )
  })

  it('treats leading ./ patterns as package-root-relative', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { './register': './src/runtime/register.ts' },
          publishConfig: { exports: { './register': './dist/runtime/register.js' } },
          sideEffects: ['./register.ts'],
        },
        './register',
      ),
      { published: false, source: false },
    )
  })

  it('is side-effectful when any conditional runtime target matches', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: {
            './runtime': {
              types: './src/runtime.d.ts',
              browser: './src/runtime.browser.ts',
              default: './src/runtime.node.ts',
            },
          },
          publishConfig: {
            exports: {
              './runtime': {
                types: './dist/runtime.d.ts',
                browser: './dist/runtime.browser.js',
                default: './dist/runtime.node.js',
              },
            },
          },
          sideEffects: ['**/*.node.*'],
        },
        './runtime',
      ),
      { published: true, source: true },
    )
  })

  it('ignores type-only conditional targets', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { './types': { types: './src/types.d.ts' } },
          publishConfig: { exports: { './types': { types: './dist/types.d.ts' } } },
          sideEffects: true,
        },
        './types',
      ),
      { published: false, source: false },
    )
  })

  it('treats invalid sideEffects arrays as side-effectful', () => {
    assert.deepEqual(
      getPackageExportSideEffects(
        {
          exports: { '.': './src/index.ts' },
          sideEffects: [false],
        },
        '.',
      ),
      { published: true, source: true },
    )
  })
})

describe('getSideEffectPatternPairingIssues', () => {
  it('accepts paired source and published file patterns', () => {
    assert.deepEqual(
      getSideEffectPatternPairingIssues([
        './src/register.ts',
        './dist/register.js',
        './src/loader.mts',
        './dist/loader.mjs',
        './src/hook.cts',
        './dist/hook.cjs',
        './src/styles/global.css',
        './dist/styles/global.css',
      ]),
      { missingPublished: [], unsupportedPatterns: [], unmatchedPublished: [] },
    )
  })

  it('reports source patterns without a published counterpart', () => {
    assert.deepEqual(getSideEffectPatternPairingIssues(['./src/register.ts']), {
      missingPublished: [{ source: './src/register.ts', expectedPublished: './dist/register.js' }],
      unsupportedPatterns: [],
      unmatchedPublished: [],
    })
  })

  it('reports published patterns without a source counterpart', () => {
    assert.deepEqual(getSideEffectPatternPairingIssues(['./dist/register.js']), {
      missingPublished: [],
      unsupportedPatterns: [],
      unmatchedPublished: ['./dist/register.js'],
    })
  })

  it('normalizes relative prefixes when pairing patterns', () => {
    assert.deepEqual(getSideEffectPatternPairingIssues(['src/register.ts', './dist/register.js']), {
      missingPublished: [],
      unsupportedPatterns: [],
      unmatchedPublished: [],
    })
  })

  it('ignores patterns outside the source and published trees', () => {
    assert.deepEqual(getSideEffectPatternPairingIssues(['*.css', './vendor/runtime.js']), {
      missingPublished: [],
      unsupportedPatterns: [],
      unmatchedPublished: [],
    })
  })

  it('reports glob patterns under source and published trees as unsupported', () => {
    assert.deepEqual(
      getSideEffectPatternPairingIssues(['./src/runtime/**/*.tsx', './dist/runtime/**/*.js']),
      {
        missingPublished: [],
        unsupportedPatterns: ['./src/runtime/**/*.tsx', './dist/runtime/**/*.js'],
        unmatchedPublished: [],
      },
    )
  })
})
