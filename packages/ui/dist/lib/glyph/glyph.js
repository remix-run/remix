import { createElement } from '@remix-run/component';
import { glyphContract, glyphNames, } from "../theme/glyph-contract.js";
export function createGlyphSheet(values) {
    let ids = Object.freeze(Object.fromEntries(glyphNames.map((name) => [name, glyphContract[name].id])));
    function GlyphSheet() {
        return (props = {}) => {
            let { style, ...svgProps } = props;
            let hiddenStyle = {
                position: 'absolute',
                width: '0',
                height: '0',
                overflow: 'hidden',
                pointerEvents: 'none',
            };
            let nextStyle = typeof style === 'object' && style !== null ? { ...hiddenStyle, ...style } : hiddenStyle;
            return createElement('svg', {
                ...svgProps,
                'aria-hidden': props['aria-hidden'] ?? true,
                focusable: props.focusable ?? 'false',
                height: props.height ?? '0',
                style: nextStyle,
                width: props.width ?? '0',
                xmlns: 'http://www.w3.org/2000/svg',
            }, glyphNames.map((name) => {
                let glyph = values[name];
                return cloneGlyphSymbol(name, glyph, ids[name]);
            }));
        };
    }
    return Object.assign(GlyphSheet, {
        ids,
        values,
    });
}
export function Glyph() {
    return (props) => {
        let { fill, name, ...svgProps } = props;
        let glyphId = glyphContract[name].id;
        let hiddenByDefault = props['aria-hidden'] === undefined &&
            props['aria-label'] === undefined &&
            props['aria-labelledby'] === undefined;
        return createElement('svg', {
            ...svgProps,
            'aria-hidden': hiddenByDefault ? true : props['aria-hidden'],
            fill: fill ?? 'none',
            xmlns: 'http://www.w3.org/2000/svg',
        }, createElement('use', {
            xlinkHref: `#${glyphId}`,
        }));
    };
}
function cloneGlyphSymbol(name, glyph, id) {
    if (glyph.type !== 'symbol') {
        throw new TypeError(`Expected glyph "${name}" to be a <symbol> element`);
    }
    return {
        ...glyph,
        key: name,
        props: {
            ...glyph.props,
            id,
        },
    };
}
//# sourceMappingURL=glyph.js.map