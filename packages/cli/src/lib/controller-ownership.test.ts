import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getFixturePath } from '../../test/fixtures.ts'
import { inspectControllerOwnership } from './controller-ownership.ts'
import { loadRouteMap } from './route-map.ts'

describe('controller ownership', () => {
  it('tracks duplicate owner files for a single route subtree', async () => {
    let ownership = await inspectControllerOwnership(
      await loadRouteMap(getFixturePath('doctor-duplicate-owner')),
    )
    let home = ownership.subtrees.find((subtree) => subtree.routeName === 'home')
    let contact = ownership.subtrees.find((subtree) => subtree.routeName === 'contact')

    assert.ok(home)
    assert.ok(contact)
    assert.deepEqual(home.actualEntryPaths, ['app/controllers/home.ts', 'app/controllers/home.tsx'])
    assert.deepEqual(contact.actualEntryPaths, [
      'app/controllers/contact/controller.ts',
      'app/controllers/contact/controller.jsx',
    ])
  })

  it('claims nested files for the deepest matching subtree', async () => {
    let ownership = await inspectControllerOwnership(
      await loadRouteMap(getFixturePath('routes-tree')),
    )
    let auth = ownership.subtrees.find((subtree) => subtree.routeName === 'auth')
    let authLogin = ownership.subtrees.find((subtree) => subtree.routeName === 'auth.login')

    assert.ok(auth)
    assert.ok(authLogin)
    assert.deepEqual(auth.claimedFilePaths, ['app/controllers/auth/controller.tsx'])
    assert.deepEqual(authLogin.claimedFilePaths, ['app/controllers/auth/login/controller.tsx'])
  })

  it('tracks promotion drift inside a standalone action subtree', async () => {
    let ownership = await inspectControllerOwnership(
      await loadRouteMap(getFixturePath('doctor-promotion-drift')),
    )
    let home = ownership.subtrees.find((subtree) => subtree.routeName === 'home')

    assert.ok(home)
    assert.equal(home.kind, 'action')
    assert.equal(home.actualEntryPath, 'app/controllers/home.js')
    assert.deepEqual(home.claimedRouteLocalFilePaths, ['app/controllers/home/page.tsx'])
  })

  it('tracks extraneous root directories outside the route tree', async () => {
    let ownership = await inspectControllerOwnership(
      await loadRouteMap(getFixturePath('doctor-orphan-route-local-file')),
    )

    assert.deepEqual(ownership.orphanRouteDirectoryPaths, ['app/controllers/unused'])
  })

  it('tracks extraneous root directories from the route-map shape', async () => {
    let ownership = await inspectControllerOwnership(
      await loadRouteMap(getFixturePath('doctor-generic-buckets')),
    )

    assert.deepEqual(ownership.orphanRouteDirectoryPaths, ['app/controllers/components'])
  })
})
