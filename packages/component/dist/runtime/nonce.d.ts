import type { RuntimeHostProps, VNodeParent } from './vnode.ts';
export type ResourceNonces = Set<string>;
type NonceManager = ReturnType<typeof createNonceManager>;
export declare function getNonceManager(): NonceManager;
export declare function resetNonceManager(): void;
declare function createNonceManager(doc: Document): {
    readonly moduleNonce: string | undefined;
    prepareResponse: (source: ParentNode, responseNonce?: string) => void;
    shouldPreserveHeadNode(node: Node): boolean;
    getRootResourceNonces(root: object): ResourceNonces | undefined;
    addRootResponseNonce: (root: object, responseNonce: string | undefined) => void;
    addRootResourceNonces: (root: object, nonces: ResourceNonces | undefined) => void;
    inheritRootResourceNonces(root: object, parent: VNodeParent): void;
    resolveResourceNonce(type: string, props: RuntimeHostProps, parent: VNodeParent): RuntimeHostProps;
    getResourceNonces: (parent: VNodeParent) => ResourceNonces | undefined;
};
export declare function getResponseNonce(response: Response): string | undefined;
export {};
