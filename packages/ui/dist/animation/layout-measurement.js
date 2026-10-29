// Recover the box before this element's transforms without changing styles.
// Ancestor transforms remain in place, just as they do in the reset/read path.
export function readUntransformedRect(node) {
    let style = getComputedStyle(node);
    if (style.transformBox !== 'view-box' && style.transformBox !== 'border-box')
        return;
    let own = readMatrix(style);
    if (!own)
        return;
    let width = borderLength(style, 'width');
    let height = borderLength(style, 'height');
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        return;
    let origin = style.transformOrigin.split(' ').map(Number.parseFloat);
    if (!Number.isFinite(origin[0]) || !Number.isFinite(origin[1]) || (origin[2] ?? 0) !== 0)
        return;
    let translate = style.translate === 'none' ? ['0', '0'] : style.translate.split(' ');
    let x = resolveLength(translate[0], width);
    let y = resolveLength(translate[1] ?? '0', height);
    if (x === undefined || y === undefined || (translate[2] && parseFloat(translate[2]) !== 0))
        return;
    own = new DOMMatrix()
        .translate(x + origin[0], y + origin[1])
        .multiply(own)
        .translate(-origin[0], -origin[1]);
    let ancestor = new DOMMatrix();
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        let matrix = readMatrix(getComputedStyle(parent));
        if (!matrix)
            return;
        ancestor = matrix.multiply(ancestor);
    }
    let natural = bounds(ancestor, width, height);
    let transformed = bounds(ancestor.multiply(own), width, height);
    if (node.getClientRects().length !== 1)
        return;
    let rect = node.getBoundingClientRect();
    // Fragmented boxes and geometry we cannot explain use the browser fallback.
    if (Math.abs(rect.width - transformed.width) > 0.1 ||
        Math.abs(rect.height - transformed.height) > 0.1)
        return;
    return new DOMRect(rect.left + natural.x - transformed.x, rect.top + natural.y - transformed.y, natural.width, natural.height);
}
function resolveLength(text, length) {
    if (!/^-?(?:\d*\.)?\d+(?:px|%)?$/.test(text))
        return;
    let value = parseFloat(text);
    return text.endsWith('%') ? (value * length) / 100 : value;
}
function borderLength(style, axis) {
    let length = parseFloat(style[axis]);
    if (style.boxSizing === 'border-box')
        return length;
    return axis === 'width'
        ? length +
            parseFloat(style.paddingLeft) +
            parseFloat(style.paddingRight) +
            parseFloat(style.borderLeftWidth) +
            parseFloat(style.borderRightWidth)
        : length +
            parseFloat(style.paddingTop) +
            parseFloat(style.paddingBottom) +
            parseFloat(style.borderTopWidth) +
            parseFloat(style.borderBottomWidth);
}
function readMatrix(style) {
    if (style.perspective !== 'none' ||
        (style.zoom !== '1' && style.zoom !== 'normal') ||
        style.offsetPath !== 'none')
        return;
    let matrix = new DOMMatrix();
    if (style.rotate !== 'none') {
        let parts = style.rotate.split(' ');
        if (parts.length > 1 && (parts.length !== 2 || parts[0] !== 'z'))
            return;
        matrix = matrix.rotate(parseFloat(parts.at(-1) ?? '0') *
            (style.rotate.endsWith('rad') && !style.rotate.endsWith('grad')
                ? 180 / Math.PI
                : style.rotate.endsWith('turn')
                    ? 360
                    : style.rotate.endsWith('grad')
                        ? 0.9
                        : 1));
    }
    if (style.scale !== 'none') {
        let scale = style.scale.split(' ').map(Number);
        if (scale.length > 2)
            return;
        matrix = matrix.scale(scale[0], scale[1] ?? scale[0]);
    }
    if (style.transform !== 'none')
        matrix = matrix.multiply(new DOMMatrix(style.transform));
    return matrix.is2D ? matrix : undefined;
}
function bounds(matrix, width, height) {
    let x = [
        matrix.e,
        matrix.a * width + matrix.e,
        matrix.c * height + matrix.e,
        matrix.a * width + matrix.c * height + matrix.e,
    ];
    let y = [
        matrix.f,
        matrix.b * width + matrix.f,
        matrix.d * height + matrix.f,
        matrix.b * width + matrix.d * height + matrix.f,
    ];
    let left = Math.min(...x);
    let top = Math.min(...y);
    return { x: left, y: top, width: Math.max(...x) - left, height: Math.max(...y) - top };
}
//# sourceMappingURL=layout-measurement.js.map