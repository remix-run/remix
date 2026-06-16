import type { VirtualRoot } from './vdom.ts'

export type ComponentStalenessCheck = (type: Function) => boolean

export let componentStalenessCheck: ComponentStalenessCheck | null = null

const roots = new Set<VirtualRoot>()

export function setComponentStalenessCheck(check: ComponentStalenessCheck): void {
  componentStalenessCheck = check
}

export function registerRoot(root: VirtualRoot): void {
  roots.add(root)
}

export function unregisterRoot(root: VirtualRoot): void {
  roots.delete(root)
}

export function reconcileRoots(): void {
  for (let root of roots) {
    root.reconcile()
  }
}
