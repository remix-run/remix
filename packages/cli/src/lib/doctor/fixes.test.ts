import * as assert from '@remix-run/assert'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from '@remix-run/test'

import { applyDoctorFixPlans } from './fixes.ts'

describe('doctor fix plans', () => {
  it('does not report skipped file creation as an applied fix', async () => {
    let appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-'))

    try {
      await fs.mkdir(path.join(appRoot, 'app', 'actions'), { recursive: true })
      await fs.writeFile(path.join(appRoot, 'app', 'actions', 'controller.js'), 'export {}\n')

      let appliedFixes = await applyDoctorFixPlans(appRoot, [
        {
          code: 'missing-owner',
          contents: 'export default { actions: {} }\n',
          kind: 'create-file',
          path: 'app/actions/controller.js',
          routeName: '<root>',
          suite: 'actions',
        },
      ])

      assert.deepEqual(appliedFixes, [])
      assert.equal(
        await fs.readFile(path.join(appRoot, 'app', 'actions', 'controller.js'), 'utf8'),
        'export {}\n',
      )
    } finally {
      await fs.rm(appRoot, { recursive: true, force: true })
    }
  })

  it('rejects fix plans that resolve outside the app root', async () => {
    let appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-'))
    let escapedPath = path.join(path.dirname(appRoot), 'escape.js')

    try {
      await assert.rejects(
        () =>
          applyDoctorFixPlans(appRoot, [
            {
              code: 'missing-owner',
              contents: 'export {}',
              kind: 'create-file',
              path: '../escape.js',
              routeName: '../../../escape',
              suite: 'actions',
            },
          ]),
        /outside the app root/,
      )

      await assert.rejects(() => fs.access(escapedPath))
    } finally {
      await fs.rm(appRoot, { recursive: true, force: true })
      await fs.rm(escapedPath, { force: true })
    }
  })
})
