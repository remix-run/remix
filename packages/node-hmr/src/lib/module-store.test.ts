import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createModuleStore, type ModuleRecord, type ModuleStore } from './module-store.ts'

describe('createModuleStore', () => {
  describe('reachable files', () => {
    it('returns only files reachable from the server entry module', () => {
      let store = createModuleStore()
      let serverUrl = addModule(store, 'server')
      let messageUrl = addModule(store, 'message')
      let valueUrl = addModule(store, 'value')
      addModule(store, 'unrelated')
      store.addDependency(serverUrl, messageUrl)
      store.addDependency(messageUrl, valueUrl)

      assert.deepEqual(
        store.getReachableFilePaths(serverUrl),
        new Set(['/app/server.ts', '/app/message.ts', '/app/value.ts']),
      )
    })

    it('replaces forward and reverse dependency edges when a module is analyzed again', () => {
      let store = createModuleStore()
      let serverUrl = addModule(store, 'server')
      let oldValueUrl = addModule(store, 'old-value')
      let currentValueUrl = addModule(store, 'current-value')
      store.addDependency(serverUrl, oldValueUrl)

      store.setModule(createModule('server'))
      store.addDependency(serverUrl, currentValueUrl)
      store.setAcceptedDependencies(serverUrl, [currentValueUrl])

      assert.deepEqual(
        store.getReachableFilePaths(serverUrl),
        new Set(['/app/server.ts', '/app/current-value.ts']),
      )
      assert.equal(store.findHotUpdateBoundaries(oldValueUrl, 10), null)
      assert.deepEqual(store.findHotUpdateBoundaries(currentValueUrl, 10), [
        boundary('current-value', 'server', ['current-value']),
      ])
    })

    it('retains every module identity backed by the same file', () => {
      let store = createModuleStore()
      let firstModule = createModule('message', { urlSuffix: '?first' })
      let secondModule = createModule('message', { urlSuffix: '?second' })
      store.setModule(firstModule)
      store.setModule(secondModule)

      assert.deepEqual(store.getModulesForFile('/app/message.ts'), [firstModule, secondModule])
    })
  })

  describe('hot update propagation', () => {
    it('propagates through transitive importers and invalidates every module on the path', () => {
      let store = createModuleStore()
      let serverUrl = addModule(store, 'server', { acceptedDependencies: ['message'] })
      let messageUrl = addModule(store, 'message')
      let valueUrl = addModule(store, 'value')
      store.addDependency(serverUrl, messageUrl)
      store.addDependency(messageUrl, valueUrl)

      assert.deepEqual(store.findHotUpdateBoundaries(valueUrl, 10), [
        boundary('message', 'server', ['value', 'message']),
      ])
    })

    it('returns every accepting branch', () => {
      let store = createModuleStore()
      let leftUrl = addModule(store, 'left', { acceptedDependencies: ['value'] })
      let rightUrl = addModule(store, 'right', { acceptedDependencies: ['value'] })
      let valueUrl = addModule(store, 'value')
      store.addDependency(leftUrl, valueUrl)
      store.addDependency(rightUrl, valueUrl)

      assert.deepEqual(store.findHotUpdateBoundaries(valueUrl, 10), [
        boundary('value', 'left', ['value']),
        boundary('value', 'right', ['value']),
      ])
    })

    it('returns null when any importer path has no acceptance boundary', () => {
      let store = createModuleStore()
      let acceptingUrl = addModule(store, 'accepting', { acceptedDependencies: ['value'] })
      let unhandledUrl = addModule(store, 'unhandled')
      let valueUrl = addModule(store, 'value')
      store.addDependency(acceptingUrl, valueUrl)
      store.addDependency(unhandledUrl, valueUrl)

      assert.equal(store.findHotUpdateBoundaries(valueUrl, 10), null)
    })

    it('deduplicates a boundary reached through converging paths and merges invalidations', () => {
      let store = createModuleStore()
      let boundaryUrl = addModule(store, 'boundary', { selfAccepting: true })
      let leftUrl = addModule(store, 'left')
      let rightUrl = addModule(store, 'right')
      let valueUrl = addModule(store, 'value')
      store.addDependency(boundaryUrl, leftUrl)
      store.addDependency(boundaryUrl, rightUrl)
      store.addDependency(leftUrl, valueUrl)
      store.addDependency(rightUrl, valueUrl)

      assert.deepEqual(store.findHotUpdateBoundaries(valueUrl, 10), [
        boundary('boundary', 'boundary', ['value', 'left', 'boundary', 'right']),
      ])
    })

    it('returns null when a cycle has no acceptance boundary', () => {
      let store = createModuleStore()
      let leftUrl = addModule(store, 'left')
      let rightUrl = addModule(store, 'right')
      store.addDependency(leftUrl, rightUrl)
      store.addDependency(rightUrl, leftUrl)

      assert.equal(store.findHotUpdateBoundaries(leftUrl, 10), null)
    })

    it('starts runtime invalidation at importers of the declining boundary', () => {
      let store = createModuleStore()
      let parentUrl = addModule(store, 'parent', { acceptedDependencies: ['message'] })
      let messageUrl = addModule(store, 'message', { selfAccepting: true })
      store.addDependency(parentUrl, messageUrl)

      assert.deepEqual(store.findHotUpdateBoundariesFromImporters(messageUrl, 10), [
        boundary('message', 'parent', ['message']),
      ])
    })

    it('uses a self-accepting transitive importer as the update boundary', () => {
      let store = createModuleStore()
      let messageUrl = addModule(store, 'message', { selfAccepting: true })
      let valueUrl = addModule(store, 'value')
      store.addDependency(messageUrl, valueUrl)

      assert.deepEqual(store.findHotUpdateBoundaries(valueUrl, 10), [
        boundary('message', 'message', ['value', 'message']),
      ])
    })

    it('fails closed when every importer is unknown', () => {
      let store = createModuleStore()
      let valueUrl = addModule(store, 'value')
      store.addDependency(moduleUrl('runtime'), valueUrl)

      assert.equal(store.findHotUpdateBoundaries(valueUrl, 10), null)
    })

    it('ignores unknown importers when a known importer accepts the update', () => {
      let store = createModuleStore()
      let serverUrl = addModule(store, 'server', { acceptedDependencies: ['value'] })
      let valueUrl = addModule(store, 'value')
      store.addDependency(moduleUrl('runtime'), valueUrl)
      store.addDependency(serverUrl, valueUrl)

      assert.deepEqual(store.findHotUpdateBoundaries(valueUrl, 10), [
        boundary('value', 'server', ['value']),
      ])
    })
  })
})

function addModule(
  store: ModuleStore,
  name: string,
  options: { acceptedDependencies?: string[]; selfAccepting?: boolean } = {},
): string {
  let module = createModule(name, options)
  store.setModule(module)
  store.setAcceptedDependencies(module.url, options.acceptedDependencies?.map(moduleUrl) ?? [])
  return module.url
}

function createModule(
  name: string,
  options: { selfAccepting?: boolean; urlSuffix?: string } = {},
): ModuleRecord {
  return {
    filePath: `/app/${name}.ts`,
    hmr: {
      acceptedDeps: [],
      selfAccepting: options.selfAccepting ?? false,
      usesImportMetaHot: options.selfAccepting ?? false,
    },
    url: `${moduleUrl(name)}${options.urlSuffix ?? ''}`,
  }
}

function boundary(acceptedDependency: string, updateHandler: string, invalidatedModules: string[]) {
  return {
    acceptedDependencyUrl: moduleUrl(acceptedDependency),
    invalidatedUrls: Object.fromEntries(invalidatedModules.map((name) => [moduleUrl(name), 10])),
    updateHandlerUrl: moduleUrl(updateHandler),
  }
}

function moduleUrl(name: string): string {
  return `file:///app/${name}.ts`
}
