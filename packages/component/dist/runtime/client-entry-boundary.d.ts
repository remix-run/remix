import type { VirtualRoot } from './vdom.ts';
export type ClientEntryIdentity = {
    moduleUrl: string;
    exportName: string;
};
type ClientEntryRoot = Pick<VirtualRoot, 'dispose' | 'render'>;
export type ClientEntryBoundaryOwner = {
    end: Comment;
    identity: ClientEntryIdentity;
    root: ClientEntryRoot;
};
export declare function getClientEntryBoundaryOwner(marker: Comment): ClientEntryBoundaryOwner | undefined;
export declare function setClientEntryBoundaryOwner(marker: Comment, end: Comment, identity: ClientEntryIdentity, root: ClientEntryRoot): ClientEntryBoundaryOwner;
export declare function disposeClientEntryBoundary(marker: Comment): boolean;
export {};
