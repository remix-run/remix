import { createController } from 'remix/router'
import { Renderer } from 'remix/middleware/render'
import { createRedirectResponse as redirect } from 'remix/response/redirect'

import { routes } from '../routes.ts'
import {
  fetchPackageContents,
  fetchPackageMetadata,
  getFilesAtPath,
  InvalidPathError,
  isFullyResolvedVersion,
  PackageNotFoundError,
  parsePackagePath,
  resolveVersion,
  VersionNotFoundError,
} from '../utils/npm.ts'
import { HomePage } from '../ui/home-page.ts'
import { renderDirectoryListing, renderError, renderFileContent } from './package-browser.ts'

export default createController(routes, {
  actions: {
    home({ get }) {
      let render = get(Renderer)
      return render({ title: 'UNPKG - npm package browser', content: HomePage() })
    },
    async packageBrowser({ get, params }) {
      let render = get(Renderer)
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
              render,
              'File not found',
              `The file "${filePath}" was not found in the package.`,
            )
          }

          return renderFileContent(render, name, resolvedVersion, filePath, file, fileData)
        }

        let files = getFilesAtPath(contents.files, filePath)
        return renderDirectoryListing(render, name, resolvedVersion, filePath, files)
      } catch (error) {
        if (error instanceof PackageNotFoundError) {
          return renderError(
            render,
            'Package not found',
            `The package "${error.packageName}" was not found on npm.`,
          )
        }
        if (error instanceof VersionNotFoundError) {
          return renderError(
            render,
            'Version not found',
            `Version "${error.version}" of package "${error.packageName}" was not found.`,
          )
        }
        if (error instanceof InvalidPathError) {
          return renderError(render, 'Invalid path', `The path "${error.path}" is not valid.`)
        }
        throw error
      }
    },
  },
})
