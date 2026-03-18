import * as path from 'node:path'
import { RoutePattern } from '@remix-run/route-pattern'

export interface ScriptRouteDefinition {
  urlPattern: string
  filePattern: string
}

interface CompiledRoute {
  root: string
  urlPattern: RoutePattern
  filePattern: RoutePattern
}

export interface CompiledRoutes {
  resolveUrlPathname(pathname: string): string | null
  toUrlPathname(filePath: string): string | null
}

export function normalizePathname(pathname: string): string {
  let normalized = pathname.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  return normalized
}

export function normalizeFilePath(filePath: string): string {
  let normalized = path.resolve(filePath).replace(/\\/g, '/')
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `/${normalized}`
  }
  return normalized
}

export function normalizeFilePattern(pattern: string): string {
  if (path.isAbsolute(pattern) || /^[A-Za-z]:[\\/]/.test(pattern)) {
    throw new Error(
      `File route patterns must be relative to script-server root.\nPattern: ${pattern}`,
    )
  }

  return normalizePathname(pattern)
}

export function compileRoutes(options: {
  routes: readonly ScriptRouteDefinition[]
  root: string
}): CompiledRoutes {
  if (options.routes.length === 0) {
    throw new Error('createScriptServer() requires at least one configured route.')
  }

  let compiledRoutes = options.routes.map((route) => compileRoute(route, { root: options.root }))

  return {
    resolveUrlPathname(pathname) {
      let normalizedPathname = normalizePathname(pathname)

      for (let route of compiledRoutes) {
        let match = route.urlPattern.match(`http://remix.run${normalizedPathname}`)
        if (!match) continue
        let relativeFilePath = route.filePattern.href(match.params).replace(/^\/+/, '')
        return normalizeFilePath(`${route.root}/${relativeFilePath}`)
      }

      return null
    },
    toUrlPathname(filePath) {
      let normalizedFilePath = normalizeFilePath(filePath)

      for (let route of compiledRoutes) {
        let relativeFilePath = getRelativeFilePath(normalizedFilePath, route.root)
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
  route: ScriptRouteDefinition,
  options: {
    root: string
  },
): CompiledRoute {
  let urlPatternSource = createUrlPatternSource(route.urlPattern)
  let filePatternSource = normalizeFilePattern(route.filePattern)

  let urlPattern = new RoutePattern(urlPatternSource)
  let filePattern = new RoutePattern(filePatternSource)

  validateNoUnnamedWildcards(urlPattern, 'URL')
  validateNoUnnamedWildcards(filePattern, 'File')
  validateRoutePatterns(urlPattern, filePattern)

  return { root: normalizeFilePath(options.root).replace(/\/+$/, ''), urlPattern, filePattern }
}

function createUrlPatternSource(pattern: string): string {
  return normalizePathname(pattern)
}

function getRelativeFilePath(filePath: string, root: string): string | null {
  if (filePath === root) return ''
  if (!filePath.startsWith(`${root}/`)) return null
  return filePath.slice(root.length + 1)
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
