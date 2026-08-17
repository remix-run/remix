type ImportMap = {
  imports?: ImportMapImports
  scopes?: Record<string, ImportMapImports>
}

type ImportMapAddress = string | null
type ImportMapImports = Record<string, ImportMapAddress>
type InstalledImportMapEntry = { href: ImportMapAddress; normalizedHref: ImportMapAddress }

type InstalledImportMap = {
  imports: Map<string, InstalledImportMapEntry>
  scopes: Map<string, Map<string, InstalledImportMapEntry>>
}

interface ImportMapManager {
  consumeImportMaps(source: ParentNode): void
  shouldPreserveHeadNode(node: Node): boolean
}

const MANAGED_IMPORT_MAP_SELECTOR = 'script[data-rmx][type="importmap"]'
const IMPORT_MAP_SELECTOR = 'script[type="importmap"]'

export function getDocumentImportMapManager(doc: Document): ImportMapManager {
  return {
    consumeImportMaps(source) {
      let scripts = Array.from(
        source.querySelectorAll<HTMLScriptElement>(MANAGED_IMPORT_MAP_SELECTOR),
      )
      let installedImportMap = readInstalledImportMap(doc, new Set(scripts))

      for (let script of scripts) {
        let importMap = parseImportMap(script.textContent ?? '')
        if (!importMap) {
          script.remove()
          continue
        }

        let baseUrl = doc.baseURI
        let importMapDelta = getImportMapDelta(installedImportMap, importMap, baseUrl)
        if (importMapDelta) {
          appendImportMapScript(doc, importMapDelta)
          mergeInstalledImportMap(installedImportMap, importMapDelta, baseUrl)
        }

        script.remove()
      }
    },
    shouldPreserveHeadNode(node) {
      return (
        node.isConnected &&
        node instanceof HTMLScriptElement &&
        node.matches(MANAGED_IMPORT_MAP_SELECTOR)
      )
    },
  }
}

function readInstalledImportMap(
  doc: Document,
  transportScripts: Set<HTMLScriptElement>,
): InstalledImportMap {
  let installedImportMap = createInstalledImportMap()
  let baseUrl = doc.baseURI

  for (let script of doc.querySelectorAll<HTMLScriptElement>(IMPORT_MAP_SELECTOR)) {
    if (transportScripts.has(script)) continue
    let importMap = parseImportMap(script.textContent ?? '')
    if (importMap) mergeInstalledImportMap(installedImportMap, importMap, baseUrl)
  }

  return installedImportMap
}

function createInstalledImportMap(): InstalledImportMap {
  return {
    imports: new Map(),
    scopes: new Map(),
  }
}

function getImportMapDelta(
  installedImportMap: InstalledImportMap,
  importMap: ImportMap,
  baseUrl: string,
): ImportMap | undefined {
  let imports = getImportMapImportsDelta(installedImportMap.imports, importMap.imports, baseUrl)
  let scopes = getImportMapScopesDelta(installedImportMap, importMap.scopes, baseUrl)
  if (!imports && !scopes) return undefined
  return {
    ...(imports ? { imports } : null),
    ...(scopes ? { scopes } : null),
  }
}

function getImportMapImportsDelta(
  installedImports: Map<string, InstalledImportMapEntry>,
  imports: ImportMapImports | undefined,
  baseUrl: string,
  scope?: string,
): ImportMapImports | undefined {
  if (!imports) return undefined

  let delta: ImportMapImports = {}
  for (let [specifier, href] of Object.entries(imports)) {
    let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl)
    if (normalizedSpecifier === null) continue
    let normalizedHref = normalizeImportMapAddress(href, baseUrl)
    let installedEntry = installedImports.get(normalizedSpecifier)
    if (installedEntry?.normalizedHref === normalizedHref) continue
    if (installedEntry) {
      let scopeDescription = scope ? ` in scope "${scope}"` : ''
      console.warn(
        `[remix] Ignoring conflicting import map entry for "${specifier}"${scopeDescription}: ` +
          `${formatImportMapAddress(installedEntry.href)} is already installed, but the new map points to ${formatImportMapAddress(href)}`,
      )
      continue
    }
    delta[specifier] = href
  }

  return Object.keys(delta).length > 0 ? delta : undefined
}

function getImportMapScopesDelta(
  installedImportMap: InstalledImportMap,
  scopes: Record<string, ImportMapImports> | undefined,
  baseUrl: string,
): Record<string, ImportMapImports> | undefined {
  if (!scopes) return undefined

  let delta: Record<string, ImportMapImports> = {}
  for (let [scope, imports] of Object.entries(scopes)) {
    let normalizedScope = normalizeImportMapUrl(scope, baseUrl)
    if (normalizedScope === null) continue
    let installedScopeImports = installedImportMap.scopes.get(normalizedScope) ?? new Map()
    let importsDelta = getImportMapImportsDelta(installedScopeImports, imports, baseUrl, scope)
    if (importsDelta) delta[scope] = importsDelta
  }

  return Object.keys(delta).length > 0 ? delta : undefined
}

function mergeInstalledImportMap(
  installedImportMap: InstalledImportMap,
  importMap: ImportMap,
  baseUrl: string,
): void {
  if (importMap.imports) {
    for (let [specifier, href] of Object.entries(importMap.imports)) {
      let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl)
      if (normalizedSpecifier === null) continue
      if (installedImportMap.imports.has(normalizedSpecifier)) continue
      installedImportMap.imports.set(normalizedSpecifier, {
        href,
        normalizedHref: normalizeImportMapAddress(href, baseUrl),
      })
    }
  }

  if (importMap.scopes) {
    for (let [scope, imports] of Object.entries(importMap.scopes)) {
      let normalizedScope = normalizeImportMapUrl(scope, baseUrl)
      if (normalizedScope === null) continue
      let installedScopeImports = installedImportMap.scopes.get(normalizedScope)
      if (!installedScopeImports) {
        installedScopeImports = new Map()
        installedImportMap.scopes.set(normalizedScope, installedScopeImports)
      }

      for (let [specifier, href] of Object.entries(imports)) {
        let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl)
        if (normalizedSpecifier === null) continue
        if (installedScopeImports.has(normalizedSpecifier)) continue
        installedScopeImports.set(normalizedSpecifier, {
          href,
          normalizedHref: normalizeImportMapAddress(href, baseUrl),
        })
      }
    }
  }
}

function appendImportMapScript(doc: Document, importMap: ImportMap): HTMLScriptElement {
  let script = doc.createElement('script')
  script.setAttribute('data-rmx', '')
  script.type = 'importmap'
  script.textContent = JSON.stringify(importMap)
  doc.head.appendChild(script)
  return script
}

function parseImportMap(json: string): ImportMap | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  let importMap: ImportMap = {}

  if ('imports' in parsed) {
    let imports = parsed.imports
    if (!isImportMapImports(imports)) return null
    importMap.imports = imports
  }

  if ('scopes' in parsed) {
    let scopes = parsed.scopes
    if (!isScopedImportMapRecord(scopes)) return null
    importMap.scopes = scopes
  }

  return importMap
}

function isImportMapImports(value: unknown): value is ImportMapImports {
  if (!value || typeof value !== 'object') return false
  return Object.values(value).every((entry) => entry === null || typeof entry === 'string')
}

function isScopedImportMapRecord(value: unknown): value is Record<string, ImportMapImports> {
  if (!value || typeof value !== 'object') return false
  return Object.values(value).every(isImportMapImports)
}

function normalizeImportMapSpecifier(specifier: string, baseUrl: string): string | null {
  if (
    specifier.startsWith('/') ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    URL.canParse(specifier)
  ) {
    return normalizeImportMapUrl(specifier, baseUrl)
  }
  return specifier
}

function normalizeImportMapAddress(address: ImportMapAddress, baseUrl: string): ImportMapAddress {
  if (address === null) return null
  return normalizeImportMapUrl(address, baseUrl)
}

function normalizeImportMapUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

function formatImportMapAddress(address: ImportMapAddress | undefined): string {
  return address === null ? 'null' : `"${address}"`
}
