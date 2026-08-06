import { invariant } from "../invariant.js";
import { isRemixElement } from "./vnode.js";
export function isEmptyChild(value) {
    return value == null || typeof value === 'boolean';
}
export function isPrimitiveChild(value) {
    let type = typeof value;
    return type === 'string' || type === 'number' || type === 'bigint';
}
export function normalizeChildren(children) {
    for (let i = 0; i < children.length; i++) {
        if (Array.isArray(children[i])) {
            return children.flat(Infinity);
        }
    }
    return children;
}
export function assertRemixNodes(values) {
    for (let value of values) {
        invariant(isRemixNode(value), 'Invalid child node');
    }
}
export function isRemixNode(value) {
    if (value == null)
        return true;
    let type = typeof value;
    if (type === 'string' || type === 'number' || type === 'bigint' || type === 'boolean') {
        return true;
    }
    if (isRemixElement(value))
        return true;
    if (!Array.isArray(value))
        return false;
    for (let child of value) {
        if (!isRemixNode(child))
            return false;
    }
    return true;
}
export function packChildren(children) {
    if (children.length === 0) {
        return undefined;
    }
    if (children.length === 1) {
        let child = children[0];
        if (child === undefined || isEmptyChild(child)) {
            return undefined;
        }
        return Array.isArray(child) ? normalizeChildren(child) : child;
    }
    let normalized = normalizeChildren(children);
    return normalized.length === 0 ? undefined : normalized;
}
//# sourceMappingURL=children.js.map