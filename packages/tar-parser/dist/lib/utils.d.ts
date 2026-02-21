export declare function buffersEqual(a: Uint8Array, b: Uint8Array): boolean;
export declare function concatChunks(a: Uint8Array, b: Uint8Array): Uint8Array;
export declare function computeChecksum(block: Uint8Array): number;
export declare function decodeLongPath(buffer: Uint8Array): string;
export declare function decodePax(buffer: Uint8Array): Record<string, string>;
export declare function indexOf(buffer: Uint8Array, value: number, offset: number, end: number): number;
export declare function getString(buffer: Uint8Array, offset: number, size: number, label?: string): string;
export declare function getOctal(buffer: Uint8Array, offset: number, size: number): number | null;
export declare function overflow(size: number): number;
//# sourceMappingURL=utils.d.ts.map