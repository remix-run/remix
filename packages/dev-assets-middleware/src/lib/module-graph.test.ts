import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createModuleGraph,
  ensureModuleNode,
  getModuleByUrl,
  getModuleByFile,
  invalidateModule,
} from './module-graph.ts'

describe('module graph', () => {
  describe('createModuleGraph', () => {
    it('creates an empty graph', () => {
      let graph = createModuleGraph()
      assert.equal(graph.urlToModule.size, 0)
      assert.equal(graph.fileToModule.size, 0)
    })
  })

  describe('ensureModuleNode', () => {
    it('creates a new module node', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      assert.equal(node.url, '/app/entry.tsx')
      assert.equal(node.file, '/abs/path/entry.tsx')
      assert.equal(node.importers.size, 0)
      assert.equal(node.importedModules.size, 0)
      assert.equal(node.transformResult, undefined)
      assert.equal(node.lastModified, undefined)
    })

    it('returns existing node by URL', () => {
      let graph = createModuleGraph()
      let node1 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let node2 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      assert.equal(node1, node2)
      assert.equal(graph.urlToModule.size, 1)
      assert.equal(graph.fileToModule.size, 1)
    })

    it('returns existing node by file path', () => {
      let graph = createModuleGraph()
      let node1 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let node2 = ensureModuleNode(graph, '/different/url.tsx', '/abs/path/entry.tsx')

      assert.equal(node1, node2)
      // Should have 2 URL mappings to same node
      assert.equal(graph.urlToModule.size, 2)
      assert.equal(graph.fileToModule.size, 1)
    })

    it('updates file path for placeholder nodes', () => {
      let graph = createModuleGraph()
      // Create placeholder node with empty file
      let node1 = ensureModuleNode(graph, '/app/entry.tsx', '')

      assert.equal(node1.file, '')
      assert.equal(graph.fileToModule.size, 0)

      // Update with real file path
      let node2 = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      assert.equal(node1, node2)
      assert.equal(node2.file, '/abs/path/entry.tsx')
      assert.equal(graph.fileToModule.size, 1)
      assert.equal(graph.fileToModule.get('/abs/path/entry.tsx'), node2)
    })
  })

  describe('getModuleByUrl', () => {
    it('returns node by URL', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      let found = getModuleByUrl(graph, '/app/entry.tsx')
      assert.equal(found, node)
    })

    it('returns undefined for non-existent URL', () => {
      let graph = createModuleGraph()
      let found = getModuleByUrl(graph, '/app/entry.tsx')
      assert.equal(found, undefined)
    })
  })

  describe('getModuleByFile', () => {
    it('returns node by file path', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      let found = getModuleByFile(graph, '/abs/path/entry.tsx')
      assert.equal(found, node)
    })

    it('returns undefined for non-existent file path', () => {
      let graph = createModuleGraph()
      let found = getModuleByFile(graph, '/abs/path/entry.tsx')
      assert.equal(found, undefined)
    })
  })

  describe('invalidateModule', () => {
    it('clears transform result and mtime', () => {
      let graph = createModuleGraph()
      let node = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')

      node.transformResult = { code: 'test code', map: null, hash: 'testhash123' }
      node.lastModified = 123456

      invalidateModule(node)

      assert.equal(node.transformResult, undefined)
      assert.equal(node.lastModified, undefined)
    })

    it('propagates invalidation to importers', () => {
      let graph = createModuleGraph()
      let entryNode = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let utilsNode = ensureModuleNode(graph, '/app/utils.ts', '/abs/path/utils.ts')

      // Setup relationship: entry imports utils
      entryNode.importedModules.add(utilsNode)
      utilsNode.importers.add(entryNode)

      // Set transform results
      entryNode.transformResult = { code: 'entry code', map: null, hash: 'entryhash' }
      entryNode.lastModified = 111
      utilsNode.transformResult = { code: 'utils code', map: null, hash: 'utilshash' }
      utilsNode.lastModified = 222

      // Invalidate utils
      invalidateModule(utilsNode)

      // Both should be invalidated
      assert.equal(utilsNode.transformResult, undefined)
      assert.equal(utilsNode.lastModified, undefined)
      assert.equal(entryNode.transformResult, undefined)
      assert.equal(entryNode.lastModified, undefined)
    })

    it('handles circular dependencies without infinite loop', () => {
      let graph = createModuleGraph()
      let nodeA = ensureModuleNode(graph, '/app/a.ts', '/abs/path/a.ts')
      let nodeB = ensureModuleNode(graph, '/app/b.ts', '/abs/path/b.ts')

      // Create circular dependency: A imports B, B imports A
      nodeA.importedModules.add(nodeB)
      nodeB.importers.add(nodeA)
      nodeB.importedModules.add(nodeA)
      nodeA.importers.add(nodeB)

      // Set transform results
      nodeA.transformResult = { code: 'a code', map: null, hash: 'ahash' }
      nodeA.lastModified = 111
      nodeB.transformResult = { code: 'b code', map: null, hash: 'bhash' }
      nodeB.lastModified = 222

      // Invalidate A - should not loop infinitely
      invalidateModule(nodeA)

      // Both should be invalidated
      assert.equal(nodeA.transformResult, undefined)
      assert.equal(nodeA.lastModified, undefined)
      assert.equal(nodeB.transformResult, undefined)
      assert.equal(nodeB.lastModified, undefined)
    })

    it('propagates through deep dependency chains', () => {
      let graph = createModuleGraph()
      let entryNode = ensureModuleNode(graph, '/app/entry.tsx', '/abs/path/entry.tsx')
      let utilsNode = ensureModuleNode(graph, '/app/utils.ts', '/abs/path/utils.ts')
      let helperNode = ensureModuleNode(graph, '/app/helper.ts', '/abs/path/helper.ts')

      // Setup chain: entry -> utils -> helper
      entryNode.importedModules.add(utilsNode)
      utilsNode.importers.add(entryNode)
      utilsNode.importedModules.add(helperNode)
      helperNode.importers.add(utilsNode)

      // Set transform results
      entryNode.transformResult = { code: 'entry code', map: null, hash: 'entryhash' }
      entryNode.lastModified = 111
      utilsNode.transformResult = { code: 'utils code', map: null, hash: 'utilshash' }
      utilsNode.lastModified = 222
      helperNode.transformResult = { code: 'helper code', map: null, hash: 'helperhash' }
      helperNode.lastModified = 333

      // Invalidate helper (leaf node)
      invalidateModule(helperNode)

      // All should be invalidated
      assert.equal(helperNode.transformResult, undefined)
      assert.equal(utilsNode.transformResult, undefined)
      assert.equal(entryNode.transformResult, undefined)
    })
  })
})
