import { describe, test } from 'node:test'
import * as assert from 'node:assert/strict'

import { buildPublishPlan } from './publish-plan.ts'
import type { PackageInfo } from './publish-plan.ts'

describe('buildPublishPlan', () => {
  // Helper to flatten waves into a single array of packages
  function flattenWaves(publishPlan: ReturnType<typeof buildPublishPlan>) {
    return publishPlan.waves.flat()
  }

  test('returns empty waves when all are already published', () => {
    let packages: PackageInfo[] = [
      { name: 'pkg-a', version: '1.0.0', directory: '/pkg-a', dependencies: [] },
      { name: 'pkg-b', version: '2.0.0', directory: '/pkg-b', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => true,
    })

    assert.equal(publishPlan.waves.length, 0)
    assert.equal(publishPlan.alreadyPublished.length, 2)
  })

  test('returns all packages when none are published', () => {
    let packages: PackageInfo[] = [
      { name: 'pkg-a', version: '1.0.0', directory: '/pkg-a', dependencies: [] },
      { name: 'pkg-b', version: '2.0.0', directory: '/pkg-b', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    assert.equal(flattenWaves(publishPlan).length, 2)
    assert.equal(publishPlan.alreadyPublished.length, 0)
  })

  test('separates published from unpublished packages', () => {
    let packages: PackageInfo[] = [
      { name: 'pkg-a', version: '1.0.0', directory: '/pkg-a', dependencies: [] },
      { name: 'pkg-b', version: '2.0.0', directory: '/pkg-b', dependencies: [] },
      { name: 'pkg-c', version: '3.0.0', directory: '/pkg-c', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: (name) => name === 'pkg-b',
    })

    let allPackages = flattenWaves(publishPlan)
    assert.equal(allPackages.length, 2)
    assert.deepEqual(allPackages.map((p) => p.name).sort(), ['pkg-a', 'pkg-c'])
    assert.equal(publishPlan.alreadyPublished.length, 1)
    assert.equal(publishPlan.alreadyPublished[0].name, 'pkg-b')
  })

  test('includes correct dist tags for stable versions', () => {
    let packages: PackageInfo[] = [
      { name: 'pkg-a', version: '1.0.0', directory: '/pkg-a', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    assert.equal(flattenWaves(publishPlan)[0].distTag, 'latest')
  })

  test('includes correct dist tags for prerelease versions', () => {
    let packages: PackageInfo[] = [
      { name: 'pkg-alpha', version: '1.0.0-alpha.0', directory: '/pkg-alpha', dependencies: [] },
      { name: 'pkg-beta', version: '2.0.0-beta.1', directory: '/pkg-beta', dependencies: [] },
      { name: 'pkg-stable', version: '3.0.0', directory: '/pkg-stable', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    let byName = Object.fromEntries(flattenWaves(publishPlan).map((p) => [p.name, p]))

    assert.equal(byName['pkg-alpha'].distTag, 'alpha')
    assert.equal(byName['pkg-beta'].distTag, 'beta')
    assert.equal(byName['pkg-stable'].distTag, 'latest')
  })

  test('includes correct git tags', () => {
    let packages: PackageInfo[] = [
      { name: '@remix-run/headers', version: '1.2.3', directory: '/headers', dependencies: [] },
      { name: 'remix', version: '3.0.0-alpha.0', directory: '/remix', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    let byName = Object.fromEntries(flattenWaves(publishPlan).map((p) => [p.name, p]))

    assert.equal(byName['@remix-run/headers'].gitTag, '@remix-run/headers@1.2.3')
    assert.equal(byName['remix'].gitTag, 'remix@3.0.0-alpha.0')
  })

  test('groups independent packages into same wave', () => {
    let packages: PackageInfo[] = [
      { name: 'pkg-a', version: '1.0.0', directory: '/pkg-a', dependencies: [] },
      { name: 'pkg-b', version: '1.0.0', directory: '/pkg-b', dependencies: [] },
      { name: 'pkg-c', version: '1.0.0', directory: '/pkg-c', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    // All independent packages should be in one wave
    assert.equal(publishPlan.waves.length, 1)
    assert.equal(publishPlan.waves[0].length, 3)
  })

  test('creates separate waves for dependent packages', () => {
    let packages: PackageInfo[] = [
      { name: 'app', version: '1.0.0', directory: '/app', dependencies: ['lib-a', 'lib-b'] },
      { name: 'lib-a', version: '1.0.0', directory: '/lib-a', dependencies: ['core'] },
      { name: 'lib-b', version: '1.0.0', directory: '/lib-b', dependencies: ['core'] },
      { name: 'core', version: '1.0.0', directory: '/core', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    // Should be: [core], [lib-a, lib-b], [app]
    assert.equal(publishPlan.waves.length, 3)
    assert.deepEqual(
      publishPlan.waves[0].map((p) => p.name),
      ['core'],
    )
    assert.deepEqual(publishPlan.waves[1].map((p) => p.name).sort(), ['lib-a', 'lib-b'])
    assert.deepEqual(
      publishPlan.waves[2].map((p) => p.name),
      ['app'],
    )
  })

  test('only includes packages that need publishing in waves', () => {
    let packages: PackageInfo[] = [
      { name: 'app', version: '1.0.0', directory: '/app', dependencies: ['lib'] },
      { name: 'lib', version: '1.0.0', directory: '/lib', dependencies: [] },
    ]

    // lib is already published, only app needs publishing
    let publishPlan = buildPublishPlan({
      packages,
      isPublished: (name) => name === 'lib',
    })

    // Only app should be in the publish list
    let allPackages = flattenWaves(publishPlan)
    assert.equal(allPackages.length, 1)
    assert.equal(allPackages[0].name, 'app')
  })

  test('handles mixed prerelease and stable packages', () => {
    let packages: PackageInfo[] = [
      { name: 'stable-pkg', version: '1.5.0', directory: '/stable', dependencies: [] },
      { name: 'alpha-pkg', version: '2.0.0-alpha.3', directory: '/alpha', dependencies: [] },
      { name: 'beta-pkg', version: '3.0.0-beta.0', directory: '/beta', dependencies: [] },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    let byName = Object.fromEntries(flattenWaves(publishPlan).map((p) => [p.name, p]))

    assert.equal(byName['stable-pkg'].distTag, 'latest')
    assert.equal(byName['alpha-pkg'].distTag, 'alpha')
    assert.equal(byName['beta-pkg'].distTag, 'beta')
  })

  test('preserves package directory in output', () => {
    let packages: PackageInfo[] = [
      {
        name: '@remix-run/headers',
        version: '1.0.0',
        directory: '/workspace/packages/headers',
        dependencies: [],
      },
    ]

    let publishPlan = buildPublishPlan({
      packages,
      isPublished: () => false,
    })

    assert.equal(flattenWaves(publishPlan)[0].directory, '/workspace/packages/headers')
  })
})
