import { reconcileAllRoots, setComponentStalenessCheck } from "../runtime/refresh.js";
export { setComponentStalenessCheck };
export function requestReconciliation() {
    reconcileAllRoots();
}
//# sourceMappingURL=refresh.js.map