import type { BuildAction } from 'remix/fetch-router'
import { createRedirectResponse as redirect } from 'remix/response/redirect'

import type { routes } from '../../routes.ts'
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
} from '../../utils/npm.ts'
import { renderDirectoryListing } from './directory.ts'
import { renderError } from './error.ts'
import { renderFileContent } from './file-content.ts'

export const packageBrowserController = {
  async handler({ params }) {
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
} satisfies BuildAction<'GET', typeof routes.packageBrowser>
