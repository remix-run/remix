import { css, type CSSMixinDescriptor } from "remix/ui";

import { componentStyleValues as styles } from "./style-values.browser.ts";

const popupViewportClampMaxHeight = "50dvh";

const popoverSurfaceTransitionCss: CSSMixinDescriptor = css({
  opacity: 0,
  "&:popover-open": {
    opacity: 1,
  },
  "&:not(:popover-open)": {
    pointerEvents: "none",
    transition:
      "opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in",
    transitionBehavior: "allow-discrete",
  },
});

const popoverSurfaceCss: CSSMixinDescriptor = css({
  position: "fixed",
  inset: "auto",
  margin: 0,
  padding: styles.space.none,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: "12rem",
  maxWidth: `min(24rem, calc(100vw - (${styles.space.lg} * 2)))`,
  maxHeight: popupViewportClampMaxHeight,
  border: `1px solid ${styles.colors.border.subtle}`,
  borderRadius: styles.radius.lg,
  backgroundColor: styles.surface.lvl0,
  color: styles.colors.text.primary,
  overflow: "hidden",
  boxShadow: `${styles.shadow.xs}, ${styles.shadow.md}`,
  "&::backdrop": {
    background: "transparent",
  },
});

const listCss: CSSMixinDescriptor = css({
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  minHeight: 0,
  paddingBlock: styles.space.xs,
  paddingInline: styles.space.none,
  overflow: "auto",
  overscrollBehavior: "contain",
  outline: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  "--rmx-ui-item-inset": `calc(${styles.space.sm} + ${styles.space.xs})`,
  "--rmx-ui-item-indicator-gap": styles.space.xs,
  "--rmx-ui-item-indicator-width": styles.fontSize.md,
});

const itemCss: CSSMixinDescriptor = css({
  display: "flex",
  alignItems: "center",
  width: "100%",
  minWidth: 0,
  minHeight: styles.control.height.md,
  boxSizing: "border-box",
  position: "relative",
  isolation: "isolate",
  paddingInline: `calc(${styles.space.sm} + ${styles.space.xs})`,
  color: styles.colors.text.primary,
  fontFamily: styles.fontFamily.sans,
  fontSize: styles.fontSize.sm,
  fontWeight: styles.fontWeight.normal,
  lineHeight: styles.lineHeight.normal,
  textAlign: "left",
  userSelect: "none",
  WebkitUserSelect: "none",
  "&::before": {
    content: '""',
    position: "absolute",
    insetBlock: 0,
    insetInline: styles.space.xs,
    borderRadius: styles.radius.md,
    backgroundColor: "transparent",
    pointerEvents: "none",
    zIndex: -1,
  },
  "&:focus": {
    outline: "none",
  },
  '&[data-highlighted="true"]': {
    color: styles.colors.action.primary.foreground,
  },
  '&[data-highlighted="true"]::before': {
    backgroundColor: styles.colors.action.primary.background,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.5,
  },
  scrollMarginBlock: styles.space.xs,
  "--rmx-listbox-option-indicator-opacity": "0",
  "&[hidden]": {
    display: "none",
  },
  '&[data-listbox-flash="true"], &[data-select-flash="true"], &[data-combobox-flash="true"]':
    {
      color: styles.colors.text.primary,
    },
  '&[data-listbox-flash="true"]::before, &[data-select-flash="true"]::before, &[data-combobox-flash="true"]::before':
    {
      backgroundColor: "transparent",
    },
  '&[aria-selected="true"]': {
    "--rmx-listbox-option-indicator-opacity": "1",
  },
});

const itemIndicatorCss: CSSMixinDescriptor = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 var(--rmx-ui-item-indicator-width)",
  width: "var(--rmx-ui-item-indicator-width)",
  minWidth: 0,
  height: "var(--rmx-ui-item-indicator-width)",
  marginInlineEnd: "var(--rmx-ui-item-indicator-gap)",
  overflow: "hidden",
  color: "currentColor",
  opacity: "var(--rmx-listbox-option-indicator-opacity)",
  "& > svg": {
    display: "block",
    width: "100%",
    height: "100%",
  },
});

const itemLabelCss: CSSMixinDescriptor = css({
  display: "inline-flex",
  alignItems: "center",
  flex: "1 1 auto",
  minWidth: 0,
  WebkitUserSelect: "none",
});

export const popoverSurfaceStyle = [
  popoverSurfaceCss,
  popoverSurfaceTransitionCss,
] as const;
export const listboxIndicatorStyle = itemIndicatorCss;
export const listboxLabelStyle = itemLabelCss;
export const listboxListStyle = listCss;
export const listboxOptionStyle = itemCss;
