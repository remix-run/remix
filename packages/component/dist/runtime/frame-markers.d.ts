export declare function isCommentNode(node: Node | null | undefined): node is Comment;
export declare function isFrameStart(node: Node): node is Comment;
export declare function isFrameEnd(node: Node): node is Comment;
export declare function isHydrationStart(node: Node): node is Comment;
export declare function isHydrationEnd(node: Node): node is Comment;
export declare function getFrameId(start: Comment): string;
export declare function findEndMarker(start: Comment, isStart: (node: Node) => boolean, isEnd: (node: Node) => node is Comment, message?: string): Comment;
export declare function collectNodesBetween(start: Comment, end: Comment): Node[];
