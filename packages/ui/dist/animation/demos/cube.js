import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, ref } from '@remix-run/ui';
export function Cube(handle) {
    let cube;
    function animate(t) {
        if (handle.signal.aborted)
            return;
        let rotate = Math.sin(t / 10000) * 200;
        let y = (1 + Math.sin(t / 1000)) * -25;
        cube.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`;
        requestAnimationFrame(animate);
    }
    return () => (_jsx("div", { mix: [
            css({
                perspective: '400px',
                width: '100px',
                height: '100px',
            }),
        ], children: _jsxs("div", { mix: [
                ref((node) => {
                    cube = node;
                    requestAnimationFrame(animate);
                }),
                css({
                    width: '100px',
                    height: '100px',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                }),
            ], children: [_jsx("div", { mix: [
                        css({
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0.6,
                            transform: 'rotateY(0deg) translateZ(50px)',
                            backgroundColor: '#ff0055',
                        }),
                    ] }), _jsx("div", { mix: [
                        css({
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0.6,
                            transform: 'rotateY(90deg) translateZ(50px)',
                            backgroundColor: '#0099ff',
                        }),
                    ] }), _jsx("div", { mix: [
                        css({
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0.6,
                            transform: 'rotateY(180deg) translateZ(50px)',
                            backgroundColor: '#22cc88',
                        }),
                    ] }), _jsx("div", { mix: [
                        css({
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0.6,
                            transform: 'rotateY(-90deg) translateZ(50px)',
                            backgroundColor: '#ffaa00',
                        }),
                    ] }), _jsx("div", { mix: [
                        css({
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0.6,
                            transform: 'rotateX(90deg) translateZ(50px)',
                            backgroundColor: '#aa00ff',
                        }),
                    ] }), _jsx("div", { mix: [
                        css({
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            opacity: 0.6,
                            transform: 'rotateX(-90deg) translateZ(50px)',
                            backgroundColor: '#ff00aa',
                        }),
                    ] })] }) }));
}
//# sourceMappingURL=cube.js.map