import type { EmittedStyle } from './emit.ts';
import type { ResolutionFailureState, ResolvedStyle } from './resolve.ts';
import type { TransformFailureState, TransformedStyle } from './transform.ts';
export type StyleWatchEvent = 'change' | 'add' | 'delete';
type StyleRecordState = {
    emitted?: EmittedStyle;
    identityPath: string;
    lastInvalidatedAt: number;
    resolved?: ResolvedStyle;
    trackedFiles: ReadonlySet<string>;
    transformed?: TransformedStyle;
};
export type StyleRecord = Readonly<StyleRecordState>;
type StyleStore = {
    get(identityPath: string): StyleRecord;
    invalidateAll(): void;
    invalidateForFileEvent(filePath: string, event: StyleWatchEvent): void;
    setEmitted(identityPath: string, emitted: EmittedStyle): void;
    setResolveFailure(identityPath: string, failure: ResolutionFailureState): void;
    setResolved(identityPath: string, resolved: ResolvedStyle): void;
    setTransformFailure(identityPath: string, failure: TransformFailureState): void;
    setTransformed(identityPath: string, transformed: TransformedStyle): void;
};
export declare function createStyleStore(): StyleStore;
export {};
//# sourceMappingURL=store.d.ts.map