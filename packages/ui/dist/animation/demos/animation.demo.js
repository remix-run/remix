import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "@remix-run/ui/jsx-runtime";
import { css, on } from '@remix-run/ui';
import { DefaultAnimate } from "./default-animate.js";
import { EnterAnimation } from "./enter.js";
import { ExitAnimation } from "./exit.js";
import { Press } from "./press.js";
import { HTMLContent } from "./html-content.js";
import { Keyframes } from "./keyframes.js";
import { InterruptibleKeyframes } from "./interruptible-keyframes.js";
import { RollingSquare } from "./rolling-square.js";
import { Rotate } from "./rotate.js";
import { TransitionOptions } from "./transition-options.js";
import { Cube } from "./cube.js";
import { SharedLayout } from "./shared-layout.js";
import { AspectRatio } from "./aspect-ratio.js";
import { BouncySwitch } from "./bouncy-switch.js";
import { ColorInterpolation } from "./color-interpolation.js";
import { FlipToggle } from "./flip-toggle.js";
import { Reordering } from "./reordering.js";
import { MultiStateBadge } from "./multi-state-badge.js";
import { HoldToConfirm } from "./hold-to-confirm.js";
import { MaterialRipple } from "./material-ripple.js";
function Tile(handle) {
    let remountKey = 0;
    return () => {
        let { title, children, notes } = handle.props;
        return (_jsxs("div", { mix: [
                css({
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: 12,
                    boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: 12,
                    position: 'relative',
                }),
            ], children: [_jsx("button", { mix: [
                        css({
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            width: 18,
                            height: 18,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            opacity: 0.4,
                            '&:hover': {
                                opacity: 1,
                            },
                        }),
                        on('click', () => {
                            remountKey++;
                            handle.update();
                        }),
                    ], title: "Replay animation", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M1 4v6h6M23 20v-6h-6" }), _jsx("path", { d: "M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" })] }) }), _jsx("h3", { mix: [css({ margin: 0 })], children: title }), _jsx("div", { mix: [
                        css({
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 280,
                        }),
                    ], children: children }, remountKey), notes && (_jsx("p", { mix: [
                        css({
                            margin: 0,
                            fontSize: 12,
                            color: '#666',
                            textAlign: 'center',
                            maxWidth: '200px',
                        }),
                    ], children: notes }))] }));
    };
}
/**
 * @name Animation Gallery
 * @description A collection of motion and animation experiments adapted from the standalone demos.
 */
export default function AnimationGallery() {
    return () => (_jsxs(_Fragment, { children: [_jsx("h1", { mix: [css({ marginBottom: 0, '& + p': { marginTop: 0 } })], children: "Animations" }), _jsxs("p", { children: ["Most animations are adapted from ", _jsx("a", { href: "https://www.motion.dev", children: "Motion" }), ". Thank you for your work ", _jsx("a", { href: "https://motion.dev/@matt", children: "Matt Perry" }), "!"] }), _jsxs("div", { mix: [
                    css({
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: 24,
                        marginTop: 40,
                    }),
                ], children: [_jsx(Tile, { title: "Default Animate", notes: "animateEntrance + animateLayout defaults", children: _jsx(DefaultAnimate, {}) }), _jsx(Tile, { title: "Rolling Square", notes: "CSS transition with spring() timing function", children: _jsx(RollingSquare, {}) }), _jsx(Tile, { title: "Enter Animation", notes: "animateEntrance() with spring physics", children: _jsx(EnterAnimation, {}) }), _jsx(Tile, { title: "Exit Animation", notes: "animateEntrance() + animateExit()", children: _jsx(ExitAnimation, {}) }), _jsx(Tile, { title: "Press Interaction", notes: "CSS transition + pointer/keyboard events", children: _jsx(Press, {}) }), _jsx(Tile, { title: "HTML Content", notes: "rAF loop with spring iterator for text", children: _jsx(HTMLContent, {}) }), _jsx(Tile, { title: "Keyframes", notes: "CSS @keyframes with infinite loop", children: _jsx(Keyframes, {}) }), _jsx(Tile, { title: "Interruptible Keyframes", notes: "Web Animations API with commitStyles()", children: _jsx(InterruptibleKeyframes, {}) }), _jsx(Tile, { title: "Rotate", notes: "CSS @keyframes (one-shot)", children: _jsx(Rotate, {}) }), _jsx(Tile, { title: "Transition Options", notes: "animateEntrance() with cubic-bezier + delay", children: _jsx(TransitionOptions, {}) }), _jsx(Tile, { title: "3D Cube", notes: "rAF loop with direct style manipulation", children: _jsx(Cube, {}) }), _jsx(Tile, { title: "Shared Layout", notes: "CSS Grid overlap for simultaneous enter/exit", children: _jsx(SharedLayout, {}) }), _jsx(Tile, { title: "Aspect Ratio", children: _jsx(AspectRatio, {}) }), _jsx(Tile, { title: "Bouncy Switch", notes: "Spring up, bounce down with CSS linear()", children: _jsx(BouncySwitch, {}) }), _jsx(Tile, { title: "FLIP Toggle", notes: "animateLayout() with interruptible WAAPI", children: _jsx(FlipToggle, {}) }), _jsx(Tile, { title: "Reordering", notes: "animateLayout() with auto-shuffling list", children: _jsx(Reordering, {}) }), _jsx(Tile, { title: "Color Interpolation", notes: "sRGB vs OKLCH color space", children: _jsx(ColorInterpolation, {}) }), _jsx(Tile, { title: "Multi-State Badge", notes: "Animated icon/label swap with WAAPI shake", children: _jsx(MultiStateBadge, {}) }), _jsx(Tile, { title: "Hold to Confirm", notes: "Custom interaction with progress tracking", children: _jsx(HoldToConfirm, {}) }), _jsx(Tile, { title: "Material Ripple", notes: "Pointer-tracked ripples with enter/exit animations", children: _jsx(MaterialRipple, {}) })] })] }));
}
//# sourceMappingURL=animation.demo.js.map