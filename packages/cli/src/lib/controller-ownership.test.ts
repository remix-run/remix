import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getFixturePath } from '../../test/fixtures.ts'
import { buildOwnedSubtrees, inspectControllerOwnership } from './controller-ownership.ts'
import { loadRouteManifest } from './route-map.ts'

describe('controller ownership', () => {
  it('does not plan a root owner when the root route map has no direct leaf routes', () => {
    let subtrees = buildOwnedSubtrees([
      {
        children: [
          {
            children: [],
            key: 'index',
            kind: 'route',
            method: 'GET',
            name: 'main.index',
          },
        ],
        key: 'main',
        kind: 'group',
        name: 'main',
      },
      {
        children: [
          {
            children: [],
            key: 'login',
            kind: 'route',
            method: 'GET',
            name: 'auth.login',
          },
        ],
        key: 'auth',
        kind: 'group',
        name: 'auth',
      },
    ])

    assert.deepEqual(
      subtrees.map((subtree) => subtree.routeName),
      ['main', 'auth'],
    )
  })

  it('tracks duplicate owner files for a single route subtree', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-duplicate-owner'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let root = ownership.subtrees.find((subtree) => subtree.routeName === '<root>')
    let contact = ownership.subtrees.find((subtree) => subtree.routeName === 'contact')

    assert.ok(root)
    assert.ok(contact)
    assert.deepEqual(root.actualEntryPaths, [
      'app/actions/controller.ts',
      'app/actions/controller.tsx',
    ])
    assert.deepEqual(contact.actualEntryPaths, [
      'app/actions/contact/controller.ts',
      'app/actions/contact/controller.jsx',
    ])
  })

  it('claims nested files for the deepest matching subtree', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('routes-tree'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let auth = ownership.subtrees.find((subtree) => subtree.routeName === 'auth')
    let authLogin = ownership.subtrees.find((subtree) => subtree.routeName === 'auth.login')

    assert.ok(auth)
    assert.ok(authLogin)
    assert.deepEqual(auth.claimedFilePaths, ['app/actions/auth/controller.tsx'])
    assert.deepEqual(authLogin.claimedFilePaths, ['app/actions/auth/login/controller.tsx'])
  })

  it('claims route-local files under the matching controller', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-incomplete-controller'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let contact = ownership.subtrees.find((subtree) => subtree.routeName === 'contact')

    assert.ok(contact)
    assert.equal(contact.actualEntryPath, null)
    assert.deepEqual(contact.claimedRouteLocalFilePaths, ['app/actions/contact/page.tsx'])
  })

  it('normalizes camelCase route keys to kebab-case disk segments', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-camel-case-keys'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)
    let forgotPassword = ownership.subtrees.find(
      (subtree) => subtree.routeName === 'auth.forgotPassword',
    )
    let resetPassword = ownership.subtrees.find(
      (subtree) => subtree.routeName === 'auth.resetPassword',
    )

    assert.ok(forgotPassword)
    assert.ok(resetPassword)
    assert.equal(forgotPassword.entryDisplayPath, 'app/actions/auth/forgot-password/controller.tsx')
    assert.equal(forgotPassword.actualEntryPath, 'app/actions/auth/forgot-password/controller.tsx')
    assert.equal(resetPassword.entryDisplayPath, 'app/actions/auth/reset-password/controller.tsx')
    assert.equal(resetPassword.actualEntryPath, 'app/actions/auth/reset-password/controller.tsx')
  })

  it('tracks extraneous root directories outside the route tree', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-orphan-route-local-file'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)

    assert.deepEqual(ownership.orphanRouteDirectoryPaths, ['app/actions/unused'])
  })

  it('tracks extraneous root directories from the route-map shape', async () => {
    let routeManifest = await loadRouteManifest(getFixturePath('doctor-generic-buckets'))
    let ownership = await inspectControllerOwnership(routeManifest.appRoot, routeManifest.tree)

    assert.deepEqual(ownership.orphanRouteDirectoryPaths, ['app/actions/components'])
  })
})
