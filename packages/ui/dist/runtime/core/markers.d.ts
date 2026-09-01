export declare function frameStartMarkerData(frameId: string): string;
export declare const FRAME_END_MARKER_DATA = " /rmx:f ";
export declare function frameStartMarkerHtml(frameId: string): string;
export declare const FRAME_END_MARKER_HTML = "<!-- /rmx:f -->";
export declare function hydrationStartMarkerHtml(instanceId: string): string;
export declare const HYDRATION_END_MARKER_HTML = "<!-- /rmx:h -->";
export declare function isCommentNode(node: Node | null | undefined): node is Comment;
export declare function isFrameStartMarker(node: Node | null | undefined): node is Comment;
export declare function isFrameEndMarker(node: Node | null | undefined): node is Comment;
export declare function isHydrationStartMarker(node: Node | null | undefined): node is Comment;
export declare function isHydrationEndMarker(node: Node | null | undefined): node is Comment;
export declare function getFrameMarkerId(marker: Comment): string;
export declare function getHydrationMarkerId(marker: Comment): string;
/**
 * Lenient variant of `getHydrationMarkerId` for nodes that may not be
 * hydration start markers at all.
 *
 * @param node Node to inspect.
 * @returns The id text (possibly empty) when the node is a hydration start marker, `undefined` otherwise.
 */
export declare function parseHydrationMarkerId(node: Node | null | undefined): string | undefined;
/**
 * Finds the end marker that closes a frame region, tracking nested regions.
 *
 * @param start Frame start marker to search from.
 * @returns The matching end marker, or `null` when the sibling list ends before the region closes.
 */
export declare function findFrameEndMarker(start: Comment): Comment | null;
/**
 * Finds the end marker that closes a hydration region, tracking nested regions.
 *
 * @param start Hydration start marker to search from.
 * @returns The matching end marker, or `null` when the sibling list ends before the region closes.
 */
export declare function findHydrationEndMarker(start: Comment): Comment | null;
/**
 * Throwing variant of `findFrameEndMarker` for regions that must be closed.
 *
 * @param start Frame start marker to search from.
 * @returns The matching end marker.
 */
export declare function getFrameEndMarker(start: Comment): Comment;
/**
 * Throwing variant of `findHydrationEndMarker` for regions that must be closed.
 *
 * @param start Hydration start marker to search from.
 * @returns The matching end marker.
 */
export declare function getHydrationEndMarker(start: Comment): Comment;
/**
 * Index-based variant of `findFrameEndMarker` over a node snapshot.
 *
 * @param nodes Sibling node snapshot to search.
 * @param startIndex Index of the frame start marker in `nodes`.
 * @returns The index of the matching end marker, or `startIndex` when the region does not close within the snapshot.
 */
export declare function findFrameEndMarkerIndex(nodes: readonly Node[], startIndex: number): number;
/**
 * Index-based variant of `findHydrationEndMarker` over a node snapshot.
 *
 * @param nodes Sibling node snapshot to search.
 * @param startIndex Index of the hydration start marker in `nodes`.
 * @returns The index of the matching end marker, or `startIndex` when the region does not close within the snapshot.
 */
export declare function findHydrationEndMarkerIndex(nodes: readonly Node[], startIndex: number): number;
