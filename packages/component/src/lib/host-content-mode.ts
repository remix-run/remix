import type { ElementProps } from './jsx.ts'
import type { VNode } from './vnode.ts'

export type HostContentMode = 'children' | 'innerHTML'

export function getHostContentMode(props: ElementProps): HostContentMode {
  return props.innerHTML != null ? 'innerHTML' : 'children'
}

export function getCanonicalHostChildren(mode: HostContentMode, children: VNode[]): VNode[] {
  return mode === 'innerHTML' ? [] : children
}
