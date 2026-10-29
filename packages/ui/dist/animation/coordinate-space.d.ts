interface Point {
    x: number;
    y: number;
}
export declare function measureCoordinateSpace(node: HTMLElement, includeSelf?: boolean, measured?: Pick<DOMRect, 'left' | 'top'>): {
    origin: {
        x: number;
        y: number;
    };
    basis: number[];
    toLocal(point: Point): Point;
    toClient(point: Point): Point;
};
export declare function sameCoordinateSpace(left: ReturnType<typeof measureCoordinateSpace>, right: ReturnType<typeof measureCoordinateSpace>): boolean;
export {};
