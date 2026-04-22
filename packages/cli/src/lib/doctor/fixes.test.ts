import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import { applyDoctorFixPlans } from './fixes.ts'

describe('doctor fix plans', () => {
  it('does not report skipped file creation as an applied fix', async () => {
    let appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-'))

    try {
      await fs.mkdir(path.join(appRoot, 'app', 'controllers'), { recursive: true })
      await fs.writeFile(path.join(appRoot, 'app', 'controllers', 'home.js'), 'export {}\n')

      let appliedFixes = await applyDoctorFixPlans(appRoot, [
        {
          code: 'missing-owner',
          contents: 'export const home = {}\n',
          kind: 'create-file',
          path: 'app/controllers/home.js',
          routeName: 'home',
          suite: 'controllers',
        },
      ])

      assert.deepEqual(appliedFixes, [])
      assert.equal(
        await fs.readFile(path.join(appRoot, 'app', 'controllers', 'home.js'), 'utf8'),
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
              suite: 'controllers',
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
