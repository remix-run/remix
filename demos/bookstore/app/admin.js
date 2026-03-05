import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { css } from 'remix/component';
import { routes } from './routes.js';
import { Layout } from './layout.js';
import { requireAuth } from './middleware/auth.js';
import { requireAdmin } from './middleware/admin.js';
import { render } from './utils/render.js';
import adminBooksController from './admin.books.js';
import adminOrdersController from './admin.orders.js';
import adminUsersController from './admin.users.js';
export default {
    middleware: [requireAuth(), requireAdmin()],
    actions: {
        index() {
            return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Admin Dashboard" }), _jsxs("div", { mix: [
                            css({
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                gap: '1.5rem',
                            }),
                        ], children: [_jsxs("div", { class: "card", children: [_jsx("h2", { children: "Manage Books" }), _jsx("p", { children: "Add, edit, or remove books from the catalog." }), _jsx("a", { href: routes.admin.books.index.href(), class: "btn", mix: [css({ marginTop: '1rem' })], children: "View Books" })] }), _jsxs("div", { class: "card", children: [_jsx("h2", { children: "Manage Users" }), _jsx("p", { children: "View and manage user accounts." }), _jsx("a", { href: routes.admin.users.index.href(), class: "btn", mix: [css({ marginTop: '1rem' })], children: "View Users" })] }), _jsxs("div", { class: "card", children: [_jsx("h2", { children: "View Orders" }), _jsx("p", { children: "Monitor and manage customer orders." }), _jsx("a", { href: routes.admin.orders.index.href(), class: "btn", mix: [css({ marginTop: '1rem' })], children: "View Orders" })] })] })] }));
        },
        books: adminBooksController,
        users: adminUsersController,
        orders: adminOrdersController,
    },
};
