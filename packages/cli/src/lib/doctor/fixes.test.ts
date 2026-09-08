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

  it('rejects fix plans that would create files through symlinked ancestors outside the app root', async () => {
    let appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-'))
    let externalAppRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-external-'))
    let externalFile = path.join(externalAppRoot, 'routes.ts')

    try {
      await fs.symlink(externalAppRoot, path.join(appRoot, 'app'), 'dir')

      await assert.rejects(
        () =>
          applyDoctorFixPlans(appRoot, [
            {
              code: 'routes-file-missing',
              contents: 'export const routes = {}\n',
              kind: 'create-file',
              path: 'app/routes.ts',
              suite: 'project',
            },
          ]),
        /outside the app root/,
      )

      await assert.rejects(() => fs.access(externalFile))
    } finally {
      await fs.rm(appRoot, { recursive: true, force: true })
      await fs.rm(externalAppRoot, { recursive: true, force: true })
    }
  })

  it('rejects fix plans that would create directories through symlinked ancestors outside the app root', async () => {
    let appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-'))
    let externalAppRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-external-'))
    let externalDirectory = path.join(externalAppRoot, 'actions')

    try {
      await fs.symlink(externalAppRoot, path.join(appRoot, 'app'), 'dir')

      await assert.rejects(
        () =>
          applyDoctorFixPlans(appRoot, [
            {
              code: 'routes-file-missing',
              kind: 'create-directory',
              path: 'app/actions',
              suite: 'project',
            },
          ]),
        /outside the app root/,
      )

      await assert.rejects(() => fs.access(externalDirectory))
    } finally {
      await fs.rm(appRoot, { recursive: true, force: true })
      await fs.rm(externalAppRoot, { recursive: true, force: true })
    }
  })

  it('rejects fix plans that would update files through symlinks outside the app root', async () => {
    let appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-'))
    let externalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-doctor-fixes-external-'))
    let externalFile = path.join(externalDir, 'package.json')

    try {
      await fs.mkdir(path.join(appRoot, 'app'))
      await fs.writeFile(externalFile, '{"name":"external"}\n')
      await fs.symlink(externalFile, path.join(appRoot, 'app', 'package.json'), 'file')

      await assert.rejects(
        () =>
          applyDoctorFixPlans(appRoot, [
            {
              code: 'node-engine-missing',
              contents: '{"name":"internal"}\n',
              kind: 'update-file',
              path: 'app/package.json',
              suite: 'environment',
            },
          ]),
        /outside the app root/,
      )

      assert.equal(await fs.readFile(externalFile, 'utf8'), '{"name":"external"}\n')
    } finally {
      await fs.rm(appRoot, { recursive: true, force: true })
      await fs.rm(externalDir, { recursive: true, force: true })
    }
  })
})
