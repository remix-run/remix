import assert from '@remix-run/assert'
import { test } from '@remix-run/test'

import { processTemplateFile } from './process-template-file.ts'

test('processTemplateFile removes inline template remove blocks', async () => {
  assert.equal(
    await processTemplateFile(
      [
        'export const values = [',
        "  'app',",
        "  /* remix-template:remove-start This is only needed inside the Remix monorepo. */'repo',/* remix-template:remove-end */",
        "  'node_modules',",
        ']',
        '',
      ].join('\n'),
      'template.ts',
    ),
    "export const values = ['app', 'node_modules']\n",
  )
})

test('processTemplateFile removes multiline template remove blocks', async () => {
  assert.equal(
    await processTemplateFile(
      [
        'before',
        '/* remix-template:remove-start */',
        'internal',
        '/* remix-template:remove-end */',
        'after',
      ].join('\n'),
      'template.txt',
    ),
    ['before', '', 'after'].join('\n'),
  )
})

test('processTemplateFile leaves files without remove blocks unformatted', async () => {
  assert.equal(await processTemplateFile('let value = 1', 'template.ts'), 'let value = 1')
})

test('processTemplateFile formats files after removing template blocks', async () => {
  assert.equal(
    await processTemplateFile(
      'let value = /* remix-template:remove-start */internal/* remix-template:remove-end */ 1',
      'template.ts',
    ),
    'let value = 1\n',
  )
})

test('processTemplateFile throws when a start marker is unmatched', async () => {
  await assert.rejects(
    () => processTemplateFile('before /* remix-template:remove-start */ after', 'template.txt'),
    /Unmatched template remove marker/,
  )
})

test('processTemplateFile throws when an end marker is unmatched', async () => {
  await assert.rejects(
    () => processTemplateFile('before /* remix-template:remove-end */ after', 'template.txt'),
    /Unmatched template remove marker/,
  )
})
