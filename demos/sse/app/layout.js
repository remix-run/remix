import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { css } from 'remix/component';
import { routes } from './routes.js';
const rawCss = String.raw;
export function Layout() {
    return ({ children }) => (_jsxs("html", { lang: "en", children: [_jsxs("head", { children: [_jsx("meta", { charSet: "UTF-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }), _jsx("title", { children: "Server-Sent Events Demo" }), _jsx("script", { type: "module", async: true, src: routes.assets.href({ path: 'entry.js' }) }), _jsx("style", { children: rawCss `
            @layer reset {
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
            }

            @keyframes pulse {
              0%,
              100% {
                opacity: 1;
              }
              50% {
                opacity: 0.5;
              }
            }

            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(-20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          ` })] }), _jsx("body", { mix: [
                    css({
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        lineHeight: 1.5,
                        padding: '2rem',
                        maxWidth: '800px',
                        margin: '0 auto',
                        background: '#f5f5f5',
                    }),
                ], children: children })] }));
}
