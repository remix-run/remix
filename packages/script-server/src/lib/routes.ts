import * as path from 'node:path'
import { RoutePattern } from '@remix-run/route-pattern'

export interface ScriptRouteDefinition {
  urlPattern: string
  filePattern: string
}

interface CompiledRoute {
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

export function normalizeFilePattern(pattern: string, root: string): string {
  if (path.isAbsolute(pattern) || /^[A-Za-z]:[\\/]/.test(pattern)) {
    throw new Error(
      `File route patterns must be relative to script-server root.\nPattern: ${pattern}`,
    )
  }

  let normalizedRoot = normalizeFilePath(root).replace(/\/+$/, '')
  return `${normalizedRoot}/${pattern.replace(/^\/+/, '')}`
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
        let match = route.urlPattern.match(`http://script-server${normalizedPathname}`)
        if (!match) continue
        return normalizeFilePath(route.filePattern.href(match.params))
      }

      return null
    },
    toUrlPathname(filePath) {
      let normalizedFilePath = normalizeFilePath(filePath)
      let fileUrl = new URL(`http://file-space${normalizedFilePath}`)

      for (let route of compiledRoutes) {
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
  let filePatternSource = normalizeFilePattern(route.filePattern, options.root)

  let urlPattern = new RoutePattern(urlPatternSource)
  let filePattern = new RoutePattern(filePatternSource)

  validateNoUnnamedWildcards(urlPattern, 'URL')
  validateNoUnnamedWildcards(filePattern, 'File')
  validateRoutePatterns(urlPattern, filePattern)

  return { urlPattern, filePattern }
}

function createUrlPatternSource(pattern: string): string {
  return normalizePathname(pattern)
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
