import assert from '@remix-run/assert'
import { test } from '@remix-run/test'

import { processTemplateFile } from './process-template-file.ts'

test('processTemplateFile removes inline template remove blocks', () => {
  assert.equal(
    processTemplateFile(
      [
        'export const values = [',
        "  'app',",
        "  /* remix-template:remove-start This is only needed inside the Remix monorepo. */'repo',/* remix-template:remove-end */",
        "  'node_modules',",
        ']',
        '',
      ].join('\n'),
    ),
    ['export const values = [', "  'app',", '  ', "  'node_modules',", ']', ''].join('\n'),
  )
})

test('processTemplateFile removes multiline template remove blocks', () => {
  assert.equal(
    processTemplateFile(
      [
        'before',
        '/* remix-template:remove-start */',
        'internal',
        '/* remix-template:remove-end */',
        'after',
      ].join('\n'),
    ),
    ['before', '', 'after'].join('\n'),
  )
})

test('processTemplateFile throws when a start marker is unmatched', () => {
  assert.throws(
    () => processTemplateFile('before /* remix-template:remove-start */ after'),
    /Unmatched template remove marker/,
  )
})

test('processTemplateFile throws when an end marker is unmatched', () => {
  assert.throws(
    () => processTemplateFile('before /* remix-template:remove-end */ after'),
    /Unmatched template remove marker/,
  )
})
