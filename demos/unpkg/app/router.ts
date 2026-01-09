import { createRouter, createRedirectResponse as redirect } from 'remix'

import { routes } from './routes.ts'
import { renderFileContent } from './file-content.ts'
import { renderDirectoryListing } from './directory.ts'
import { renderError } from './error.ts'
import {
  parsePackagePath,
  fetchPackageMetadata,
  fetchPackageContents,
  getFilesAtPath,
  isFullyResolvedVersion,
  resolveVersion,
  PackageNotFoundError,
  VersionNotFoundError,
  InvalidPathError,
} from './utils/npm.ts'
import { html, render } from './utils/render.ts'

export let router = createRouter()

router.map(routes, {
  home() {
    return render(
      'UNPKG - npm package browser',
      html`
        <h1><span class="brand">UNPKG</span></h1>
        <div class="home-content">
          <p>Browse the contents of any npm package by entering its name in the URL.</p>
          <p>
            For example, visit <code>/lodash</code> to browse the latest version of lodash, or
            <code>/react@18</code> to browse React version 18.
          </p>
          <p>
            You can also browse specific files by adding the file path, like
            <code>/lodash/package.json</code>.
          </p>

          <div class="examples">
            <h2>Try these packages:</h2>
            <ul>
              <li><a href="/@remix-run/cookie">@remix-run/cookie</a> - scoped package</li>
              <li><a href="/react">react</a> - UI library</li>
              <li><a href="/express">express</a> - web framework</li>
              <li><a href="/typescript@5">typescript@5</a> - specific major version</li>
            </ul>
          </div>
        </div>
      `,
    )
  },

  async browse({ params }) {
    let path = params.path ?? ''

    if (!path) {
      return redirect('/')
    }

    try {
      let { name, version, filePath } = parsePackagePath(path)

      let metadata = await fetchPackageMetadata(name)

      if (!isFullyResolvedVersion(metadata, version)) {
        let resolvedVersion = resolveVersion(metadata, version)
        let redirectUrl = `/${name}@${resolvedVersion}${filePath ? '/' + filePath : ''}`
        return redirect(redirectUrl)
      }

      let contents = await fetchPackageContents(name, version)
      let resolvedVersion = contents.metadata.version

      let file = contents.files.get(filePath)

      if (filePath && file?.type === 'file') {
        let fileData = await contents.getFileContent(filePath)
        if (!fileData) {
          return renderError(
            'File not found',
            `The file "${filePath}" was not found in the package.`,
          )
        }
        return renderFileContent(name, resolvedVersion, filePath, file, fileData)
      }

      let files = getFilesAtPath(contents.files, filePath)
      return renderDirectoryListing(name, resolvedVersion, filePath, files)
    } catch (error) {
      if (error instanceof PackageNotFoundError) {
        return renderError(
          'Package not found',
          `The package "${error.packageName}" was not found on npm.`,
        )
      }
      if (error instanceof VersionNotFoundError) {
        return renderError(
          'Version not found',
          `Version "${error.version}" of package "${error.packageName}" was not found.`,
        )
      }
      if (error instanceof InvalidPathError) {
        return renderError('Invalid path', `The path "${error.path}" is not valid.`)
      }
      throw error
    }
  },
})
