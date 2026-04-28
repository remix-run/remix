import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  invalidPackageName,
  projectRootNotFound,
  renderCliError,
  routesFileNotFound,
  UsageError,
} from './errors.ts'

describe('errors', () => {
  it('stores contextual data for invalid package names', async () => {
    let error = invalidPackageName('My Remix App')

    assert.ok(error instanceof UsageError)
    assert.equal(error.code, 'RMX_INVALID_PACKAGE_NAME')
    assert.deepEqual(error.context, {
      input: 'My Remix App',
    })
  })

  it('stores contextual data for path-based errors', async () => {
    let projectRootError = projectRootNotFound('/tmp/remix-app')
    let routesFileError = routesFileNotFound('/tmp/remix-app/app')

    assert.deepEqual(projectRootError.context, {
      startDir: '/tmp/remix-app',
    })
    assert.deepEqual(routesFileError.context, {
      startDir: '/tmp/remix-app/app',
    })
  })

  it('renders the error code, title, message, and fix guidance', async () => {
    let output = renderCliError(invalidPackageName('My Remix App'))

    assert.match(output, /Error \[RMX_INVALID_PACKAGE_NAME\] Could not derive a valid package name/)
    assert.match(output, /Could not derive a valid package name from "My Remix App"\./)
    assert.match(
      output,
      /Try:\n  Choose an app name that can be normalized into a valid npm package name\./,
    )
  })
})
