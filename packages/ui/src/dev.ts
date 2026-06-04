import {
  componentStalenessCheck,
  reconcileAllRoots,
  setComponentStalenessCheck,
} from './runtime/refresh.ts'

export { componentStalenessCheck, setComponentStalenessCheck }
export type { ComponentStalenessCheck } from './runtime/refresh.ts'

export function requestReconciliation(): void {
  reconcileAllRoots()
}
