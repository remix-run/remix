import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getFixturePath } from '../../test/fixtures.ts'
import { inspectControllerOwnership } from './controller-ownership.ts'
import { loadRouteManifest } from './route-map.ts'

describe('controller ownership', () => {
  it('tracks duplicate owner files for a single route subtree', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-duplicate-owner'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
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
    let routeManifest = await loadRouteManifest(getFixturePath('routes-tree'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let auth = ownership.subtrees.find((subtree) => subtree.routeName === 'auth')
    let authLogin = ownership.subtrees.find((subtree) => subtree.routeName === 'auth.login')

    assert.ok(auth)
    assert.ok(authLogin)
    assert.deepEqual(auth.claimedFilePaths, ['app/controllers/auth/controller.tsx'])
    assert.deepEqual(authLogin.claimedFilePaths, ['app/controllers/auth/login/controller.tsx'])
  })

  it('tracks promotion drift inside a standalone action subtree', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-promotion-drift'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let home = ownership.subtrees.find((subtree) => subtree.routeName === 'home')

    assert.ok(home)
    assert.equal(home.kind, 'action')
    assert.equal(home.actualEntryPath, 'app/controllers/home.js')
    assert.deepEqual(home.claimedRouteLocalFilePaths, ['app/controllers/home/page.tsx'])
  })

  it('normalizes camelCase route keys to kebab-case disk segments', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-camel-case-keys'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let userSettings = ownership.subtrees.find((subtree) => subtree.routeName === 'userSettings')
    let forgotPassword = ownership.subtrees.find(
      (subtree) => subtree.routeName === 'auth.forgotPassword',
    )
    let resetPassword = ownership.subtrees.find(
      (subtree) => subtree.routeName === 'auth.resetPassword',
    )

    assert.ok(userSettings)
    assert.ok(forgotPassword)
    assert.ok(resetPassword)
    assert.equal(userSettings.entryDisplayPath, 'app/controllers/user-settings.tsx')
    assert.equal(userSettings.actualEntryPath, 'app/controllers/user-settings.tsx')
    assert.equal(
      forgotPassword.entryDisplayPath,
      'app/controllers/auth/forgot-password/controller.tsx',
    )
    assert.equal(
      forgotPassword.actualEntryPath,
      'app/controllers/auth/forgot-password/controller.tsx',
    )
    assert.equal(
      resetPassword.entryDisplayPath,
      'app/controllers/auth/reset-password/controller.tsx',
    )
    assert.equal(
      resetPassword.actualEntryPath,
      'app/controllers/auth/reset-password/controller.tsx',
    )
  })

  it('tracks extraneous root directories outside the route tree', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-orphan-route-local-file'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)

    assert.deepEqual(ownership.orphanRouteDirectoryPaths, ['app/controllers/unused'])
  })

  it('tracks extraneous root directories from the route-map shape', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-generic-buckets'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)

    assert.deepEqual(ownership.orphanRouteDirectoryPaths, ['app/controllers/components'])
  })
})
