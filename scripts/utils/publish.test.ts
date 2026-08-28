import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  createPublishPlan,
  getReleaseNotes,
  isPackageVersionPublished,
  type PublishCandidate,
  type RegistryRequest,
} from './publish.ts'

function makePackage(packageName: string): PublishCandidate {
  return {
    packageName,
    version: '1.0.0',
    tag: `${packageName}@1.0.0`,
  }
}

function createRegistryRequest(
  status: number,
  statusText = '',
): {
  request: RegistryRequest
  urls: URL[]
} {
  let urls: URL[] = []

  return {
    request(url) {
      urls.push(url)
      return Promise.resolve(new Response(null, { status, statusText }))
    },
    urls,
  }
}

describe('getReleaseNotes', () => {
  it('combines skipped changelog entries since the previous published version', async () => {
    let publishedVersions = new Set(['3.0.0-beta.6'])
    let notes = await getReleaseNotes({
      entries: [
        { version: '3.0.0-beta.9', body: 'Beta 9 changes' },
        { version: '3.0.0-beta.8', body: 'Beta 8 changes' },
        { version: '3.0.0-beta.7', body: 'Beta 7 changes' },
        { version: '3.0.0-beta.6', body: 'Beta 6 changes' },
      ],
      targetVersion: '3.0.0-beta.9',
      isVersionPublished: async (version) => publishedVersions.has(version),
    })

    assert.equal(
      notes,
      `This release includes all changes since v3.0.0-beta.6.

## v3.0.0-beta.7

Beta 7 changes

## v3.0.0-beta.8

Beta 8 changes

## v3.0.0-beta.9

Beta 9 changes`,
    )
  })

  it('uses the target changelog entry when the previous version was published', async () => {
    let notes = await getReleaseNotes({
      entries: [
        { version: '0.7.0', body: 'Current changes' },
        { version: '0.6.0', body: 'Previous changes' },
      ],
      targetVersion: '0.7.0',
      isVersionPublished: async () => true,
    })

    assert.equal(notes, 'Current changes')
  })

  it('returns null when the target changelog entry is missing', async () => {
    let notes = await getReleaseNotes({
      entries: [],
      targetVersion: '1.0.0',
      isVersionPublished: async () => false,
    })

    assert.equal(notes, null)
  })
})

describe('isPackageVersionPublished', () => {
  it('checks scoped packages using the npm registry API', async () => {
    let { request, urls } = createRegistryRequest(200)

    assert.equal(
      await isPackageVersionPublished('@remix-run/static-middleware', '0.4.14', request),
      true,
    )
    assert.deepEqual(urls.map(String), [
      'https://registry.npmjs.org/%40remix-run%2Fstatic-middleware/0.4.14',
    ])
  })

  it('returns false when the package version is not found', async () => {
    let { request } = createRegistryRequest(404, 'Not Found')

    assert.equal(await isPackageVersionPublished('remix', '3.0.0-beta.8', request), false)
  })

  it('fails when the registry cannot answer the request', async () => {
    let { request } = createRegistryRequest(503, 'Service Unavailable')

    await assert.rejects(
      isPackageVersionPublished('remix', '3.0.0-beta.8', request),
      /Could not check remix@3\.0\.0-beta\.8 on npm: 503 Service Unavailable/,
    )
  })
})

describe('createPublishPlan', () => {
  it('publishes dependencies first and prerelease packages after latest packages', () => {
    let plan = createPublishPlan({
      packages: [makePackage('remix'), makePackage('@remix-run/app'), makePackage('@remix-run/db')],
      prereleaseDirNames: new Set(['remix']),
      getDirectoryName(packageName) {
        if (packageName === 'remix') return 'remix'
        return packageName.slice('@remix-run/'.length)
      },
      getDependencies(packageName) {
        if (packageName === '@remix-run/app') return ['@remix-run/db']
        return []
      },
    })

    assert.deepEqual(
      plan.map((pkg) => [pkg.packageName, pkg.npmTag]),
      [
        ['@remix-run/db', 'latest'],
        ['@remix-run/app', 'latest'],
        ['remix', 'next'],
      ],
    )
  })

  it('only plans the unpublished packages provided by the caller', () => {
    let plan = createPublishPlan({
      packages: [makePackage('@remix-run/unpublished')],
      prereleaseDirNames: new Set(),
      getDirectoryName() {
        return 'unpublished'
      },
      getDependencies() {
        return ['@remix-run/already-published']
      },
    })

    assert.deepEqual(
      plan.map((pkg) => pkg.packageName),
      ['@remix-run/unpublished'],
    )
  })

  it('fails when a package cannot be mapped to a workspace directory', () => {
    assert.throws(
      () =>
        createPublishPlan({
          packages: [makePackage('@remix-run/unknown')],
          prereleaseDirNames: new Set(),
          getDirectoryName() {
            return null
          },
          getDependencies() {
            return []
          },
        }),
      /Could not map package "@remix-run\/unknown" to a workspace directory/,
    )
  })
})
