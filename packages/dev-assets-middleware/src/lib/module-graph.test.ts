import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createModuleGraph, ensureModuleNode, getModuleByUrl } from './module-graph.ts'

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
})
