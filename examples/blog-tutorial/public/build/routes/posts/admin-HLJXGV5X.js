import {
  require_post
} from "/build/_shared/chunk-7PL4GFKS.js";
import {
  Link,
  Outlet,
  useLoaderData
} from "/build/_shared/chunk-DOPJ42JF.js";
import {
  React,
  __toESM,
  init_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// browser-route-module:/Users/johnhooks/Projects/remix/examples/blog-tutorial/app/routes/posts/admin.tsx?browser
init_react();

// app/routes/posts/admin.tsx
init_react();
var import_post = __toESM(require_post());
function PostAdmin() {
  const { posts } = useLoaderData();
  return /* @__PURE__ */ React.createElement("div", {
    className: "mx-auto max-w-4xl"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "my-6 mb-2 border-b-2 text-center text-3xl"
  }, "Blog Admin"), /* @__PURE__ */ React.createElement("div", {
    className: "grid grid-cols-4 gap-6"
  }, /* @__PURE__ */ React.createElement("nav", {
    className: "col-span-4 md:col-span-1"
  }, /* @__PURE__ */ React.createElement("ul", null, posts.map((post) => /* @__PURE__ */ React.createElement("li", {
    key: post.slug
  }, /* @__PURE__ */ React.createElement(Link, {
    to: post.slug,
    className: "text-blue-600 underline"
  }, post.title))))), /* @__PURE__ */ React.createElement("main", {
    className: "col-span-4 md:col-span-3"
  }, /* @__PURE__ */ React.createElement(Outlet, null))));
}
export {
  PostAdmin as default
};
//# sourceMappingURL=/build/routes/posts/admin-HLJXGV5X.js.map
