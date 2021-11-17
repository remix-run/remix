import {
  require_session
} from "/build/_shared/chunk-JHG2B4Q5.js";
import {
  require_db
} from "/build/_shared/chunk-SMZ7NZN3.js";
import {
  Form,
  Link,
  import_react_router_dom,
  useCatch,
  useLoaderData
} from "/build/_shared/chunk-P2NWWZRW.js";
import {
  React,
  __toModule,
  init_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// browser-route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes.tsx?browser
init_react();

// app/routes/jokes.tsx
init_react();
var import_db = __toModule(require_db());
var import_session = __toModule(require_session());

// app/styles/jokes.css
var jokes_default = "/build/_assets/jokes-SL6K6US3.css";

// app/routes/jokes.tsx
var links = () => {
  return [{ rel: "stylesheet", href: jokes_default }];
};
function Footer() {
  return /* @__PURE__ */ React.createElement("footer", {
    className: "jokes-footer"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement(Link, {
    reloadDocument: true,
    to: "/jokes-rss"
  }, "RSS")));
}
function Header({ user }) {
  return /* @__PURE__ */ React.createElement("header", {
    className: "jokes-header"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "home-link"
  }, /* @__PURE__ */ React.createElement(Link, {
    to: "/",
    title: "Remix Jokes",
    "aria-label": "Remix Jokes"
  }, /* @__PURE__ */ React.createElement("span", {
    className: "logo"
  }, "\u{1F92A}"), /* @__PURE__ */ React.createElement("span", {
    className: "logo-medium"
  }, "J\u{1F92A}KES"))), user ? /* @__PURE__ */ React.createElement("div", {
    className: "user-info"
  }, /* @__PURE__ */ React.createElement("span", null, `Hi ${user.username}`), /* @__PURE__ */ React.createElement(Form, {
    action: "/logout",
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Logout"))) : /* @__PURE__ */ React.createElement(Link, {
    to: "/login"
  }, "Login")));
}
function Layout({ children }) {
  let data = useLoaderData();
  return /* @__PURE__ */ React.createElement("div", {
    className: "jokes-layout"
  }, /* @__PURE__ */ React.createElement(Header, {
    user: data.user
  }), /* @__PURE__ */ React.createElement("main", {
    className: "jokes-main"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, children)), /* @__PURE__ */ React.createElement(Footer, null));
}
function JokesScreen() {
  let data = useLoaderData();
  return /* @__PURE__ */ React.createElement(Layout, null, /* @__PURE__ */ React.createElement("div", {
    className: "jokes-list"
  }, data.jokeListItems.length ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Link, {
    to: "."
  }, "Get a random joke"), /* @__PURE__ */ React.createElement("p", null, "Here are a few more jokes to check out:"), /* @__PURE__ */ React.createElement("ul", null, data.jokeListItems.map(({ id, name }) => /* @__PURE__ */ React.createElement("li", {
    key: id
  }, /* @__PURE__ */ React.createElement(Link, {
    to: id
  }, name)))), /* @__PURE__ */ React.createElement(Link, {
    to: "new",
    className: "button"
  }, "Add your own")) : null), /* @__PURE__ */ React.createElement("div", {
    className: "jokes-outlet"
  }, /* @__PURE__ */ React.createElement(import_react_router_dom.Outlet, null)));
}
function CatchBoundary() {
  let caught = useCatch();
  switch (caught.status) {
    case 401:
    case 404:
      return /* @__PURE__ */ React.createElement(Layout, null, /* @__PURE__ */ React.createElement("h1", null, caught.status, ": ", caught.statusText));
    default:
      throw new Error(`Unexpected caught response with status: ${caught.status}`);
  }
}
export {
  CatchBoundary,
  JokesScreen as default,
  links
};
//# sourceMappingURL=/build/routes/jokes-EXFCEBWK.js.map
