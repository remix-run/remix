import type { VirtualRoot } from './vdom.ts';
export type ComponentStalenessCheck = (type: Function) => boolean;
export declare let componentStalenessCheck: ComponentStalenessCheck | null;
export declare function setComponentStalenessCheck(check: ComponentStalenessCheck): void;
export declare function registerRoot(root: VirtualRoot): void;
export declare function unregisterRoot(root: VirtualRoot): void;
export declare function reconcileAllRoots(): void;
