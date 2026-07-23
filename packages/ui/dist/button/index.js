import { createMixin, css } from '@remix-run/ui';
import { renderMixinElement } from "../runtime/mixins/mixin.js";
const buttonDefaultAttrs = createMixin((handle, hostType) => (props) => {
    if (hostType !== 'button' || props.type !== undefined) {
        return handle.element;
    }
    return renderMixinElement(handle.element, {
        ...props,
        type: 'button',
    });
})();
const baseStyle = css({
    '--rmx-button-shadow': '0 0 0 0 rgba(0, 0, 0, 0)',
    '--rmx-button-focus-shadow': '0 0 0 1px #3573F6, var(--rmx-button-shadow), 0 0 0 4px rgba(53, 115, 246, 0.1), 0 6px 32px 4px rgba(53, 115, 246, 0.08), inset 0 0 8px 1px rgba(53, 115, 246, 0.05)',
    appearance: 'none',
    margin: 0,
    boxSizing: 'border-box',
    cursor: 'revert',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: '4px',
    paddingBlock: 0,
    width: 'max-content',
    maxWidth: '100%',
    borderRadius: '999px',
    fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    fontStyle: 'normal',
    fontWeight: 500,
    fontFeatureSettings: '"cv01" on, "ss01" on',
    letterSpacing: 0,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    verticalAlign: 'top',
    boxShadow: 'var(--rmx-button-shadow)',
    '&:focus-visible': {
        outline: 0,
        boxShadow: 'var(--rmx-button-focus-shadow)',
    },
    '&:disabled, &[aria-disabled="true"]': {
        cursor: 'not-allowed',
        opacity: 0.55,
    },
});
const mediumStyle = css({
    height: '26px',
    minHeight: '26px',
    paddingInline: '12px',
    fontSize: '12px',
    lineHeight: '17px',
    '--rmx-button-neutral-shadow-alpha': '0.03',
});
const largeStyle = css({
    height: '30px',
    minHeight: '30px',
    paddingInline: '12px',
    fontSize: '13px',
    lineHeight: '20px',
    '--rmx-button-neutral-shadow-alpha': '0.04',
});
const neutralStyle = css({
    background: '#FCFCFC',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    '--rmx-button-shadow': '0 -2px 0 -2px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.75), 0 1px 0 #FFFFFF, 0 2px 4px -1px rgb(0 0 0 / var(--rmx-button-neutral-shadow-alpha)), inset 0 2px 0 #FFFFFF, inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
    color: '#101010',
    textShadow: '0 1px 0 #FFFFFF',
    '&:hover:not(:disabled):not([aria-disabled="true"])': {
        background: '#FFFFFF',
        borderColor: 'rgba(0, 0, 0, 0.1)',
        '--rmx-button-shadow': '0 -2px 0 -2px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8), 0 1px 0 #FFFFFF, 0 3px 6px -2px rgb(0 0 0 / calc(var(--rmx-button-neutral-shadow-alpha) + 0.03)), inset 0 2px 0 #FFFFFF, inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
    },
    '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])': {
        background: '#F7F7F7',
        borderColor: 'rgba(0, 0, 0, 0.12)',
        '--rmx-button-shadow': '0 0 0 1px rgba(255, 255, 255, 0.65), inset 0 1px 2px rgba(0, 0, 0, 0.08), inset 0 -1px 0 rgba(255, 255, 255, 0.8)',
        textShadow: 'none',
    },
});
const primaryStyle = css({
    background: 'radial-gradient(50% 50% at 50% 0%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 66.46%), #101010',
    border: 0,
    '--rmx-button-shadow': '0 16px 16px -8px rgba(0, 0, 0, 0.1), 0 8px 8px -4px rgba(0, 0, 0, 0.1), 0 4px 4px -2px rgba(0, 0, 0, 0.1), 0 2px 2px -1px rgba(0, 0, 0, 0.1), inset 0 0 4px 2px #101010, inset 0 0 4px 2px rgba(255, 255, 255, 0.1), inset 0 0 12px -6px rgba(255, 255, 255, 0.75)',
    color: '#FFFFFF',
    textShadow: '0 1px 1px #000000',
    '&:hover:not(:disabled):not([aria-disabled="true"])': {
        background: 'radial-gradient(50% 50% at 50% 0%, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 66.46%), #171717',
        '--rmx-button-shadow': '0 18px 18px -10px rgba(0, 0, 0, 0.14), 0 8px 8px -4px rgba(0, 0, 0, 0.12), 0 4px 4px -2px rgba(0, 0, 0, 0.1), 0 2px 2px -1px rgba(0, 0, 0, 0.1), inset 0 0 4px 2px #101010, inset 0 0 4px 2px rgba(255, 255, 255, 0.13), inset 0 0 12px -6px rgba(255, 255, 255, 0.85)',
    },
    '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])': {
        background: 'radial-gradient(50% 50% at 50% 0%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 66.46%), #080808',
        '--rmx-button-shadow': '0 2px 2px -1px rgba(0, 0, 0, 0.14), inset 0 0 4px 2px #050505, inset 0 1px 2px rgba(0, 0, 0, 0.45), inset 0 0 10px -6px rgba(255, 255, 255, 0.55)',
        textShadow: '0 1px 1px #000000',
    },
    '&:active:not(:disabled):not([aria-disabled="true"])': {
        transform: 'translateY(1px)',
    },
});
const ghostStyle = css({
    background: 'transparent',
    border: '1px solid transparent',
    '--rmx-button-shadow': '0 0 0 0 rgba(0, 0, 0, 0)',
    color: '#101010',
    textShadow: 'none',
    '&:hover:not(:disabled):not([aria-disabled="true"])': {
        background: 'rgba(16, 16, 16, 0.05)',
    },
    '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])': {
        background: 'rgba(16, 16, 16, 0.08)',
    },
});
const sizeStyles = {
    md: mediumStyle,
    lg: largeStyle,
};
const toneStyles = {
    neutral: neutralStyle,
    primary: primaryStyle,
    ghost: ghostStyle,
};
export function button(options = {}) {
    let { size = 'md', tone = 'neutral' } = options;
    return [buttonDefaultAttrs, baseStyle, sizeStyles[size], toneStyles[tone]];
}
export default button;
//# sourceMappingURL=index.js.map