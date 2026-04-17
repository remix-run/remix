import { RoutePattern } from '@remix-run/route-pattern'

import {
  isAbsoluteFilePath,
  normalizeFilePath,
  normalizePathname,
  resolveFilePath,
} from './paths.ts'

export interface AssetRouteDefinition {
  urlPattern: string
  filePattern: string
}

interface CompiledRoute {
  rootDir: string
  urlPattern: RoutePattern
  filePattern: RoutePattern
}

export interface CompiledRoutes {
  resolveUrlPathname(pathname: string): string | null
  toUrlPathname(filePath: string): string | null
}

function normalizeFilePattern(pattern: string): string {
  if (isAbsoluteFilePath(pattern)) {
    throw new Error(
      `File route patterns must be relative to the asset server root.\nPattern: ${pattern}`,
    )
  }

  return normalizePathname(pattern)
}

export function compileRoutes(options: {
  fileMap: Readonly<Record<string, string>>
  rootDir: string
}): CompiledRoutes {
  if (Object.keys(options.fileMap).length === 0) {
    throw new Error('createAssetServer() requires at least one configured fileMap entry.')
  }

  let compiledRoutes = Object.entries(options.fileMap).map(([urlPattern, filePattern]) =>
    compileRoute(
      {
        urlPattern,
        filePattern,
      },
      { rootDir: options.rootDir },
    ),
  )

  return {
    resolveUrlPathname(pathname) {
      let normalizedPathname = normalizePathname(pathname)

      for (let route of compiledRoutes) {
        let match = route.urlPattern.match(`http://remix.run${normalizedPathname}`)
        if (!match) continue
        let relativeFilePath = route.filePattern.href(match.params).replace(/^\/+/, '')
        return resolveFilePath(route.rootDir, relativeFilePath)
      }

      return null
    },
    toUrlPathname(filePath) {
      let normalizedFilePath = normalizeFilePath(filePath)

      for (let route of compiledRoutes) {
        let relativeFilePath = getRelativeFilePath(normalizedFilePath, route.rootDir)
        if (relativeFilePath === null) continue

        let fileUrl = new URL(`http://remix.run/${relativeFilePath}`)
        let match = route.filePattern.match(fileUrl)
        if (!match) continue
        return normalizePathname(route.urlPattern.href(match.params))
      }

      return null
    },
  }
}

function compileRoute(
  route: AssetRouteDefinition,
  options: {
    rootDir: string
  },
): CompiledRoute {
  let urlPatternSource = normalizePathname(route.urlPattern)
  let filePatternSource = normalizeFilePattern(route.filePattern)

  let urlPattern = new RoutePattern(urlPatternSource)
  let filePattern = new RoutePattern(filePatternSource)

  validateNoUnnamedWildcards(urlPattern, 'URL')
  validateNoUnnamedWildcards(filePattern, 'File')
  validateRoutePatterns(urlPattern, filePattern)

  return {
    rootDir: normalizeFilePath(options.rootDir).replace(/\/+$/, ''),
    urlPattern,
    filePattern,
  }
}

function getRelativeFilePath(filePath: string, rootDir: string): string | null {
  if (filePath === rootDir) return ''
  if (!filePath.startsWith(`${rootDir}/`)) return null
  return filePath.slice(rootDir.length + 1)
}

function validateRoutePatterns(urlPattern: RoutePattern, filePattern: RoutePattern): void {
  let urlParams = urlPattern.ast.pathname.params.map(
    (param: { name: string; type: ':' | '*' }) => `${param.type}:${param.name}`,
  )
  let fileParams = filePattern.ast.pathname.params.map(
    (param: { name: string; type: ':' | '*' }) => `${param.type}:${param.name}`,
  )

  if (urlParams.length !== fileParams.length) {
    throw new Error(
      `Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`,
    )
  }

  for (let i = 0; i < urlParams.length; i++) {
    if (urlParams[i] !== fileParams[i]) {
      throw new Error(
        `Route patterns must have matching capture structure.\nURL: ${urlPattern}\nFile: ${filePattern}`,
      )
    }
  }
}

function validateNoUnnamedWildcards(pattern: RoutePattern, label: string): void {
  if (
    pattern.ast.pathname.params.some(
      (param: { name: string; type: ':' | '*' }) => param.type === '*' && param.name === '*',
    )
  ) {
    throw new Error(
      `${label} route patterns must use named wildcards for reversible mapping.\nPattern: ${pattern}`,
    )
  }
}
