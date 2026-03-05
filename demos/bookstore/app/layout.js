import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "remix/component/jsx-runtime";
import { routes } from './routes.js';
import { getCurrentUserSafely } from './utils/context.js';
export function Document() {
    return ({ title = 'Bookstore', children }) => (_jsxs("html", { lang: "en", children: [_jsxs("head", { children: [_jsx("meta", { charSet: "UTF-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }), _jsx("title", { children: title }), _jsx("script", { type: "module", async: true, src: routes.assets.href({ path: 'entry.js' }) }), _jsx("link", { rel: "stylesheet", href: "/app.css" })] }), _jsx("body", { children: children })] }));
}
export function Layout() {
    return ({ children }) => {
        let user = getCurrentUserSafely();
        return (_jsxs(Document, { children: [_jsx("header", { children: _jsxs("div", { class: "container", children: [_jsx("h1", { children: _jsx("a", { href: routes.home.href(), children: "\uD83D\uDCDA Bookstore" }) }), _jsxs("nav", { children: [_jsx("a", { href: routes.home.href(), children: "Home" }), _jsx("a", { href: routes.books.index.href(), children: "Books" }), _jsx("a", { href: routes.about.href(), children: "About" }), _jsx("a", { href: routes.contact.index.href(), children: "Contact" }), _jsx("a", { href: routes.cart.index.href(), children: "Cart" }), user ? (_jsxs(_Fragment, { children: [_jsx("a", { href: routes.account.index.href(), children: "Account" }), user.role === 'admin' ? _jsx("a", { href: routes.admin.index.href(), children: "Admin" }) : null, _jsx("form", { method: "POST", action: routes.auth.logout.href(), style: { display: 'inline' }, children: _jsx("button", { type: "submit", class: "btn btn-secondary", style: "margin-left: 1rem;", children: "Logout" }) })] })) : (_jsxs(_Fragment, { children: [_jsx("a", { href: routes.auth.login.index.href(), children: "Login" }), _jsx("a", { href: routes.auth.register.index.href(), children: "Register" })] }))] })] }) }), _jsx("main", { children: _jsx("div", { class: "container", children: children }) }), _jsx("footer", { children: _jsx("div", { class: "container", children: _jsxs("p", { children: ["\u00A9 ", new Date().getFullYear(), " Bookstore Demo. Built with Remix."] }) }) })] }));
    };
}
