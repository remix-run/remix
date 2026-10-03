import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { RemixNode } from './jsx.ts'
import { jsx } from './jsx.ts'
import { toVNode } from './to-vnode.ts'
import type {
  CommittedComponentNode,
  CommittedFrameNode,
  CommittedHostNode,
  CommittedVNode,
  ComponentNode,
  FrameNode,
  HostNode,
  VNodeInput,
  VNodeParent,
} from './vnode.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

type HasKey<value, key extends PropertyKey> = key extends keyof value ? true : false

function expectType<condition extends true>(): void {}

describe('VNode lifecycle types', () => {
  it('keeps node-kind resources on their owning variants', () => {
    expectType<
      Equal<VNodeInput['kind'], 'empty' | 'text' | 'fragment' | 'host' | 'component' | 'frame'>
    >()
    expectType<Equal<HostNode['props']['children'], RemixNode | undefined>>()
    expectType<Equal<HostNode['props']['innerHTML'], string | undefined>>()
    expectType<Equal<HasKey<HostNode, '_dom'>, false>>()
    expectType<Equal<HasKey<ComponentNode, '_handle'>, false>>()
    expectType<Equal<HasKey<FrameNode, '_state'>, false>>()
    expectType<Equal<HasKey<CommittedHostNode, '_content'>, false>>()
    expectType<Equal<HasKey<CommittedComponentNode, '_dom'>, false>>()
    expectType<Equal<HasKey<CommittedFrameNode, '_children'>, false>>()
    expectType<
      Equal<CommittedVNode extends { _parent: VNodeParent; _svg: boolean } ? true : false, true>
    >()
    expectType<Equal<CommittedVNode extends VNodeInput ? true : false, false>>()
    expectType<Equal<CommittedHostNode extends HostNode ? true : false, false>>()
    expectType<Equal<CommittedComponentNode extends ComponentNode ? true : false, false>>()
    expectType<Equal<CommittedFrameNode extends FrameNode ? true : false, false>>()
  })

  it('converts elements into complete unmounted variants', () => {
    let vnode = toVNode(
      jsx('section', {
        children: ['hello', jsx('strong', { children: 'world' })],
        innerHTML: undefined,
      }),
    )

    assert.equal(vnode.kind, 'host')
    if (vnode.kind !== 'host') return

    assert.equal(vnode.type, 'section')
    assert.equal(vnode._children.length, 2)
    assert.equal(vnode._children[0].kind, 'text')
    assert.equal(vnode._children[1].kind, 'host')
    assert.equal('_dom' in vnode, false)
  })

  it('validates framework props at the element boundary', () => {
    assert.throws(() => toVNode(jsx('div', { innerHTML: 42 })), /Invalid innerHTML prop/)
    assert.throws(() => toVNode(jsx('div', { mix: {} })), /Invalid mix prop/)
  })
})
