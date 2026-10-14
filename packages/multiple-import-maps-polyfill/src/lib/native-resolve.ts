import {
  asURL,
  resolveAndComposeImportMap,
  resolveIfNotPlainOrUrl,
  resolveImportMap,
} from './resolve.ts'
import type { ImportMap } from './resolve.ts'

let importMap: ImportMap = { imports: {}, scopes: {}, integrity: {} }
const processedScripts = new WeakSet<HTMLScriptElement>()
const selector = 'script[type="importmap"]'
const observer =
  typeof document === 'undefined' ? undefined : new MutationObserver(processMutations)

if (observer) {
  observer.observe(document, { childList: true })
  observer.observe(document.head, { childList: true })
  processImportMaps()
}

export function resolveModuleUrl(specifier: string, parentUrl: string): string {
  if (observer) processMutations(observer.takeRecords())
  processImportMaps()
  let normalized = resolveIfNotPlainOrUrl(specifier, parentUrl) || asURL(specifier) || specifier
  let resolved = resolveImportMap(importMap, normalized, parentUrl)
  if (!resolved) throw new TypeError(`Unable to resolve specifier '${specifier}' from ${parentUrl}`)
  return resolved
}

function processImportMaps(): void {
  for (let script of document.querySelectorAll<HTMLScriptElement>(selector))
    processImportMap(script)
}

function processMutations(mutations: MutationRecord[]): void {
  for (let mutation of mutations) {
    for (let node of mutation.addedNodes) {
      if (node instanceof HTMLScriptElement && node.matches(selector)) processImportMap(node)
    }
  }
}

function processImportMap(script: HTMLScriptElement): void {
  if (processedScripts.has(script)) return
  processedScripts.add(script)
  if (script.src) return
  let parsed: unknown
  try {
    parsed = JSON.parse(script.textContent ?? '')
  } catch {
    return
  }
  if (!isRecord(parsed)) return
  let scopes: Record<string, Record<string, unknown>> = {}
  if (isRecord(parsed.scopes)) {
    for (let [scope, entries] of Object.entries(parsed.scopes)) {
      if (isRecord(entries)) scopes[scope] = entries
    }
  }
  importMap = resolveAndComposeImportMap(
    { imports: isRecord(parsed.imports) ? parsed.imports : undefined, scopes },
    script.baseURI,
    importMap,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
