import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
import { css } from 'remix/component';
import { routes } from './routes.js';
import { BookCard } from './components/book-card.js';
import { Layout } from './layout.js';
import { loadAuth } from './middleware/auth.js';
import { ilike, inList, or } from 'remix/data-table';
import { books } from './data/schema.js';
import { render } from './utils/render.js';
import { getCurrentCart } from './utils/context.js';
export let home = {
    middleware: [loadAuth()],
    async action({ db }) {
        let cart = getCurrentCart();
        let featuredSlugs = ['bbq', 'heavy-metal', 'three-ways'];
        let featuredBookRows = await db.findMany(books, {
            where: inList('slug', featuredSlugs),
        });
        let featuredBooksBySlug = new Map(featuredBookRows.map((book) => [book.slug, book]));
        let featuredBooks = featuredSlugs.flatMap((slug) => {
            let book = featuredBooksBySlug.get(slug);
            return book ? [book] : [];
        });
        return render(_jsxs(Layout, { children: [_jsxs("div", { class: "card", children: [_jsx("h1", { children: "Welcome to the Bookstore" }), _jsx("p", { mix: [css({ margin: '1rem 0' })], children: "Discover your next favorite book from our curated collection of fiction, non-fiction, and more." }), _jsx("p", { children: _jsx("a", { href: routes.books.index.href(), class: "btn", children: "Browse Books" }) })] }), _jsx("h2", { mix: [css({ margin: '2rem 0 1rem' })], children: "Featured Books" }), _jsx("div", { class: "grid", children: featuredBooks.map((book) => {
                        let inCart = cart.items.some((item) => item.slug === book.slug);
                        return _jsx(BookCard, { book: book, inCart: inCart });
                    }) })] }), { headers: { 'Cache-Control': 'no-store' } });
    },
};
export let about = {
    middleware: [loadAuth()],
    action() {
        return render(_jsx(Layout, { children: _jsxs("div", { class: "card", children: [_jsx("h1", { children: "About Our Bookstore" }), _jsxs("p", { mix: [css({ margin: '1rem 0' })], children: ["Welcome to our online bookstore, a demo application built to showcase the capabilities of", _jsx("strong", { children: "fetch-router" }), " - a powerful, type-safe routing library for web applications."] }), _jsx("h2", { mix: [css({ margin: '1.5rem 0 0.5rem' })], children: "What This Demo Shows" }), _jsxs("ul", { mix: [css({ marginLeft: '2rem', lineHeight: 2 })], children: [_jsxs("li", { children: [_jsx("strong", { children: "Resource Routes:" }), " Full RESTful CRUD operations"] }), _jsxs("li", { children: [_jsx("strong", { children: "Nested Routes:" }), " Deep route hierarchies with type safety"] }), _jsxs("li", { children: [_jsx("strong", { children: "Custom Parameters:" }), " Flexible parameter naming (slug, orderId, etc.)"] }), _jsxs("li", { children: [_jsx("strong", { children: "HTTP Methods:" }), " GET, POST, PUT, DELETE properly used"] }), _jsxs("li", { children: [_jsx("strong", { children: "Middleware:" }), " Authentication and authorization"] }), _jsxs("li", { children: [_jsx("strong", { children: "Type Safety:" }), " End-to-end type checking for routes and handlers"] })] }), _jsx("h2", { mix: [css({ margin: '1.5rem 0 0.5rem' })], children: "Try It Out" }), _jsx("p", { mix: [css({ margin: '1rem 0' })], children: "Explore the site to see all these features in action. You can browse books, create an account, add items to your cart, and even access the admin panel (login as admin@bookstore.com / admin123)." }), _jsxs("p", { mix: [css({ marginTop: '2rem' })], children: [_jsx("a", { href: routes.books.index.href(), class: "btn", children: "Explore Books" }), _jsx("a", { href: routes.auth.register.index.href(), class: "btn btn-secondary", mix: [css({ marginLeft: '1rem' })], children: "Create Account" })] })] }) }));
    },
};
export let contact = {
    middleware: [loadAuth()],
    actions: {
        index() {
            return render(_jsx(Layout, { children: _jsxs("div", { class: "card", children: [_jsx("h1", { children: "Contact Us" }), _jsx("p", { mix: [css({ margin: '1rem 0' })], children: "Have a question or feedback? We'd love to hear from you!" }), _jsxs("form", { method: "POST", action: routes.contact.action.href(), children: [_jsxs("div", { class: "form-group", children: [_jsx("label", { for: "name", children: "Name" }), _jsx("input", { type: "text", id: "name", name: "name", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "email", children: "Email" }), _jsx("input", { type: "email", id: "email", name: "email", required: true })] }), _jsxs("div", { class: "form-group", children: [_jsx("label", { for: "message", children: "Message" }), _jsx("textarea", { id: "message", name: "message", required: true })] }), _jsx("button", { type: "submit", class: "btn", children: "Send Message" })] })] }) }));
        },
        async action() {
            return render(_jsxs(Layout, { children: [_jsx("div", { class: "alert alert-success", children: "Thank you for your message! We'll get back to you soon." }), _jsx("div", { class: "card", children: _jsx("p", { children: _jsx("a", { href: routes.home.href(), class: "btn", children: "Return Home" }) }) })] }));
        },
    },
};
export let search = {
    middleware: [loadAuth()],
    async action({ db, url }) {
        let query = url.searchParams.get('q') ?? '';
        let matchingBooks = query
            ? await db.findMany(books, {
                where: or(ilike('title', `%${query.toLowerCase()}%`), ilike('author', `%${query.toLowerCase()}%`), ilike('description', `%${query.toLowerCase()}%`)),
                orderBy: ['id', 'asc'],
            })
            : [];
        let cart = getCurrentCart();
        return render(_jsxs(Layout, { children: [_jsx("h1", { children: "Search Results" }), _jsx("div", { class: "card", mix: [css({ marginBottom: '2rem' })], children: _jsxs("form", { action: routes.search.href(), method: "GET", mix: [css({ display: 'flex', gap: '0.5rem' })], children: [_jsx("input", { type: "search", name: "q", placeholder: "Search books...", value: query, mix: [css({ flex: 1, padding: '0.5rem' })] }), _jsx("button", { type: "submit", class: "btn", children: "Search" })] }) }), query ? (_jsxs("p", { mix: [css({ marginBottom: '1rem' })], children: ["Found ", matchingBooks.length, " result(s) for \"", query, "\""] })) : null, _jsx("div", { class: "grid", children: matchingBooks.length > 0 ? (matchingBooks.map((book) => {
                        let inCart = cart.items.some((item) => item.slug === book.slug);
                        return _jsx(BookCard, { book: book, inCart: inCart });
                    })) : (_jsx("p", { children: "No books found matching your search." })) })] }));
    },
};
