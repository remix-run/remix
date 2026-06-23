export type FlushKind = 'document' | 'fragment';
export declare function appendFlushMarker(html: string, kind: FlushKind): string;
export declare function stripFlushMarkers(html: string): string;
export declare function findFlushMarker(html: string, startIndex: number): {
    index: number;
    endIndex: number;
    kind: FlushKind;
} | undefined;
