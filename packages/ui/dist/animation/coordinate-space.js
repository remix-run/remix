import { measureUntransformed } from './animation-host.js';
// Convert movement between client coordinates and the element's 2D ancestor transforms.
export function measureCoordinateSpace(node, includeSelf = false, measured) {
    let matrix = new DOMMatrix();
    for (let parent = includeSelf ? node : node.parentElement; parent; parent = parent.parentElement) {
        let style = getComputedStyle(parent);
        let local = new DOMMatrix();
        if (style.rotate !== 'none') {
            let angle = style.rotate.split(' ').at(-1) ?? '0deg';
            local = local.multiply(new DOMMatrix(`rotate(${angle})`));
        }
        if (style.scale !== 'none') {
            let scale = style.scale.split(' ').map(Number);
            local = local.scale(scale[0], scale[1] ?? scale[0]);
        }
        if (style.transform !== 'none')
            local = local.multiply(new DOMMatrix(style.transform));
        matrix = local.multiply(matrix);
    }
    let { a, b, c, d } = matrix;
    let determinant = a * d - b * c;
    let box = measured ?? (includeSelf ? node.getBoundingClientRect() : measureUntransformed(node));
    // Bounding rects report an axis-aligned envelope. Recover the transformed
    // top-left corner before converting points back into local coordinates.
    let origin = {
        x: box.left - Math.min(0, a * node.offsetWidth) - Math.min(0, c * node.offsetHeight),
        y: box.top - Math.min(0, b * node.offsetWidth) - Math.min(0, d * node.offsetHeight),
    };
    return {
        origin,
        basis: [a, b, c, d],
        toLocal(point) {
            if (Math.abs(determinant) < 0.000001)
                return { x: 0, y: 0 };
            return {
                x: (d * point.x - c * point.y) / determinant,
                y: (a * point.y - b * point.x) / determinant,
            };
        },
        toClient(point) {
            return { x: a * point.x + c * point.y, y: b * point.x + d * point.y };
        },
    };
}
export function sameCoordinateSpace(left, right) {
    return (Math.abs(left.origin.x - right.origin.x) < 0.01 &&
        Math.abs(left.origin.y - right.origin.y) < 0.01 &&
        left.basis.every((value, index) => Math.abs(value - right.basis[index]) < 0.00001));
}
//# sourceMappingURL=coordinate-space.js.map