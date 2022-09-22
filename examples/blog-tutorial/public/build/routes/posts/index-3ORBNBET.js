import {
  require_post
} from "/build/_shared/chunk-7PL4GFKS.js";
import {
  Link,
  useLoaderData
} from "/build/_shared/chunk-DOPJ42JF.js";
import {
  React,
  __toESM,
  init_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// browser-route-module:/Users/johnhooks/Projects/remix/examples/blog-tutorial/app/routes/posts/index.tsx?browser
init_react();

// app/routes/posts/index.tsx
init_react();
var import_post = __toESM(require_post());
function Posts() {
  const { posts } = useLoaderData();
  return /* @__PURE__ */ React.createElement("main", null, /* @__PURE__ */ React.createElement("h1", null, "Posts"), /* @__PURE__ */ React.createElement(Link, {
    to: "admin",
    className: "text-red-600 underline"
  }, "Admin"), /* @__PURE__ */ React.createElement("ul", null, posts.map((post) => /* @__PURE__ */ React.createElement("li", {
    key: post.slug
  }, /* @__PURE__ */ React.createElement(Link, {
    to: `/posts/${post.slug}`,
    className: "text-blue-600 underline"
  }, post.title)))));
}
export {
  Posts as default
};
//# sourceMappingURL=/build/routes/posts/index-3ORBNBET.js.map
