import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PluginAfterCommitEvent,
  PluginBeforeCommitEvent,
  PluginCommitEvent,
  ReconcilerErrorEvent,
  definePlugin,
} from './types.ts'
import type { HostPropDelta, Plugin, PluginHostContext, ReconcilerRoot, RenderValue } from './types.ts'

describe('types helpers', () => {
  it('constructs commit lifecycle events with root references', () => {
    let root = {} as ReconcilerRoot<RenderValue>
    let before = new PluginBeforeCommitEvent(root)
    let after = new PluginAfterCommitEvent(root)

    assert.equal(before.type, 'beforeCommit')
    assert.equal(before.root, root)
    assert.equal(after.type, 'afterCommit')
    assert.equal(after.root, root)
  })

  it('constructs reconciler error events with cause', () => {
    let error = new Error('boom')
    let event = new ReconcilerErrorEvent(error)
    assert.equal(event.type, 'error')
    assert.equal(event.cause, error)
  })

  it('proxies plugin commit event operations to host context', () => {
    let consumed = new Set<string>()
    let replaced: null | Record<string, unknown> = null
    let root = {} as ReconcilerRoot<RenderValue>
    let host = { id: 1, type: 'button', node: {} } as any
    let delta: HostPropDelta = {
      kind: 'mount',
      previousProps: {},
      nextProps: { title: 'next' },
      changedKeys: ['title'],
    }
    let context: PluginHostContext = {
      root,
      host,
      delta,
      replaceProps(props) {
        replaced = props
      },
      consume(key) {
        consumed.add(key)
      },
      isConsumed(key) {
        return consumed.has(key)
      },
      remainingPropsView() {
        return { title: 'next' }
      },
    }

    let event = new PluginCommitEvent(context)
    event.replaceProps({ role: 'button' })
    event.consume('title')

    assert.deepEqual(replaced, { role: 'button' })
    assert.equal(event.isConsumed('title'), true)
    assert.deepEqual(event.remainingPropsView(), { title: 'next' })
    assert.equal(event.root, root)
    assert.equal(event.host, host)
    assert.equal(event.delta, delta)
  })

  it('returns plugin values unchanged from definePlugin', () => {
    let plugin: Plugin = {
      phase: 'special',
      keys: ['title'],
      shouldActivate() {
        return true
      },
    }
    let factory = () => plugin

    assert.equal(definePlugin(plugin), plugin)
    assert.equal(definePlugin(factory), factory)
  })
})
