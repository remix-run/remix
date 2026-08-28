import { createElement } from '@remix-run/ui';
function icon(handle, children) {
    let hiddenByDefault = handle.props['aria-hidden'] === undefined &&
        handle.props['aria-label'] === undefined &&
        handle.props['aria-labelledby'] === undefined;
    return createElement('svg', {
        ...handle.props,
        'aria-hidden': hiddenByDefault ? true : handle.props['aria-hidden'],
        fill: handle.props.fill ?? 'none',
        viewBox: handle.props.viewBox ?? '0 0 16 16',
        xmlns: 'http://www.w3.org/2000/svg',
    }, children);
}
function strokedPath(d) {
    return createElement('path', {
        d,
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
    });
}
export function AddIcon(handle) {
    return () => icon(handle, strokedPath('M8 3.25v9.5M3.25 8h9.5'));
}
export function CheckIcon(handle) {
    return () => icon(handle, strokedPath('m3.5 8.25 2.75 2.75L12.5 4.75'));
}
export function ChevronDownIcon(handle) {
    return () => icon(handle, strokedPath('m3.75 6.25 4.25 4 4.25-4'));
}
export function ChevronRightIcon(handle) {
    return () => icon(handle, strokedPath('m6 4 4 4-4 4'));
}
export function ChevronVerticalIcon(handle) {
    return () => icon(handle, [strokedPath('m3.75 6.5 4.25-4 4.25 4'), strokedPath('m3.75 9.5 4.25 4 4.25-4')]);
}
export function SearchIcon(handle) {
    return () => icon(handle, strokedPath('M7.25 12.25a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm3.54-1.46 3 3'));
}
//# sourceMappingURL=icons.js.map