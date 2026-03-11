import type { ComponentHandle } from './component.ts'
import type { DomRange } from './runtime.ts'
import type { CommittedComponentNode, VNode } from './vnode.ts'
import { isComponentNode } from './vnode.ts'

export type ComponentInstance = {
  handle: ComponentHandle
  domParent: ParentNode
  parentComponent: ComponentInstance | undefined
  parentVNode: VNode | undefined
  vnode: CommittedComponentNode | undefined
  content: VNode | null
  range: DomRange
}

let componentInstances = new WeakMap<ComponentHandle, ComponentInstance>()

export function getComponentInstance(
  handle: ComponentHandle | undefined,
): ComponentInstance | undefined {
  return handle ? componentInstances.get(handle) : undefined
}

export function getNearestParentComponentInstance(
  vnode: VNode | undefined,
): ComponentInstance | undefined {
  let current = vnode
  while (current) {
    if (isComponentNode(current)) {
      let instance = getComponentInstance(current._handle)
      if (instance) return instance
    }
    current = current._parent
  }
  return undefined
}

export function bindComponentInstance(init: {
  handle: ComponentHandle
  domParent: ParentNode
  parentComponent: ComponentInstance | undefined
  parentVNode: VNode | undefined
  vnode: CommittedComponentNode
  content: VNode | null
  range?: DomRange
}): ComponentInstance {
  let instance = componentInstances.get(init.handle)
  if (!instance) {
    instance = {
      handle: init.handle,
      domParent: init.domParent,
      parentComponent: init.parentComponent,
      parentVNode: init.parentVNode,
      vnode: init.vnode,
      content: init.content,
      range: init.range ?? { first: null, last: null },
    }
    componentInstances.set(init.handle, instance)
    return instance
  }

  instance.domParent = init.domParent
  instance.parentComponent = init.parentComponent
  instance.parentVNode = init.parentVNode
  instance.vnode = init.vnode
  instance.content = init.content
  instance.range = init.range ?? instance.range
  return instance
}

export function unbindComponentInstance(handle: ComponentHandle): void {
  componentInstances.delete(handle)
}
