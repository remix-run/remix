import {
  require_session
} from "/build/_shared/chunk-JHG2B4Q5.js";
import {
  require_db
} from "/build/_shared/chunk-SMZ7NZN3.js";
import {
  Form,
  Link,
  useActionData,
  useLoaderData
} from "/build/_shared/chunk-P2NWWZRW.js";
import {
  React,
  __toModule,
  init_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// browser-route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes/new.tsx?browser
init_react();

// app/routes/jokes/new.tsx
init_react();
var import_db = __toModule(require_db());
var import_session = __toModule(require_session());
function JokeScreen() {
  var _a, _b, _c, _d, _e, _f, _g;
  let data = useLoaderData();
  let actionData = useActionData();
  if (!data.loggedIn) {
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "You must be logged in to create a joke."), /* @__PURE__ */ React.createElement(Link, {
      to: "/login"
    }, "Login"));
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Add your own hilarious joke"), /* @__PURE__ */ React.createElement(Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", null, "Name:", " ", /* @__PURE__ */ React.createElement("input", {
    type: "text",
    defaultValue: (_a = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _a.name,
    name: "name",
    "aria-describedby": ((_b = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _b.name) ? "name-error" : void 0
  })), ((_c = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _c.name) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert",
    id: "name-error"
  }, (_d = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _d.name) : null), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", null, "Content:", " ", /* @__PURE__ */ React.createElement("textarea", {
    defaultValue: (_e = actionData == null ? void 0 : actionData.fields) == null ? void 0 : _e.content,
    name: "content"
  })), ((_f = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _f.content) ? /* @__PURE__ */ React.createElement("p", {
    className: "form-validation-error",
    role: "alert",
    id: "content-error"
  }, (_g = actionData == null ? void 0 : actionData.fieldErrors) == null ? void 0 : _g.content) : null), /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Add")));
}
export {
  JokeScreen as default
};
//# sourceMappingURL=/build/routes/jokes/new-NEQ26LNM.js.map
