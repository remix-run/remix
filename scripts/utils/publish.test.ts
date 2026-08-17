import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  createPublishPlan,
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

describe('isPackageVersionPublished', () => {
  it('checks scoped packages using the npm registry API', async () => {
    let { request, urls } = createRegistryRequest(200)

    assert.equal(
      await isPackageVersionPublished('@remix-run/static-files-middleware', '0.1.0', request),
      true,
    )
    assert.deepEqual(urls.map(String), [
      'https://registry.npmjs.org/%40remix-run%2Fstatic-files-middleware/0.1.0',
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
