import {
  require_post
} from "/build/_shared/chunk-7PL4GFKS.js";
import {
  Form,
  useActionData,
  useTransition
} from "/build/_shared/chunk-DOPJ42JF.js";
import {
  React,
  __toESM,
  init_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// browser-route-module:/Users/johnhooks/Projects/remix/examples/blog-tutorial/app/routes/posts/admin/new.tsx?browser
init_react();

// app/routes/posts/admin/new.tsx
init_react();
var import_post = __toESM(require_post());
var inputClassName = `w-full rounded border border-gray-500 px-2 py-1 text-lg`;
function NewPost() {
  const errors = useActionData();
  const transition = useTransition();
  const isCreating = Boolean(transition.submission);
  return /* @__PURE__ */ React.createElement(Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", null, "Post Title:", " ", (errors == null ? void 0 : errors.title) ? /* @__PURE__ */ React.createElement("em", {
    className: "text-red-600"
  }, errors.title) : null, /* @__PURE__ */ React.createElement("input", {
    type: "text",
    name: "title",
    className: inputClassName
  }))), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", null, "Post Slug:", " ", (errors == null ? void 0 : errors.slug) ? /* @__PURE__ */ React.createElement("em", {
    className: "text-red-600"
  }, errors.slug) : null, /* @__PURE__ */ React.createElement("input", {
    type: "text",
    name: "slug",
    className: inputClassName
  }))), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", {
    htmlFor: "markdown"
  }, "Markdown:", " ", (errors == null ? void 0 : errors.markdown) ? /* @__PURE__ */ React.createElement("em", {
    className: "text-red-600"
  }, errors.markdown) : null), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("textarea", {
    id: "markdown",
    rows: 20,
    name: "markdown",
    className: `${inputClassName} font-mono`
  })), /* @__PURE__ */ React.createElement("p", {
    className: "text-right"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300",
    disabled: isCreating
  }, isCreating ? "Creating..." : "Create Post")));
}
export {
  NewPost as default
};
//# sourceMappingURL=/build/routes/posts/admin/new-6NJCLOD4.js.map
