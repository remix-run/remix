import { reconcileAllRoots, setComponentStalenessCheck } from '../runtime/refresh.ts'

export { setComponentStalenessCheck }
export type { ComponentStalenessCheck } from '../runtime/refresh.ts'

export function requestReconciliation(): void {
  reconcileAllRoots()
}
