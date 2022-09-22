import {
  require_note
} from "/build/_shared/chunk-BURPMA5Y.js";
import {
  useUser
} from "/build/_shared/chunk-L7NQLBEK.js";
import {
  require_session
} from "/build/_shared/chunk-3UULGQSB.js";
import {
  Form,
  Link,
  NavLink,
  Outlet,
  useLoaderData
} from "/build/_shared/chunk-DOPJ42JF.js";
import {
  React,
  __toESM,
  init_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// browser-route-module:/Users/johnhooks/Projects/remix/examples/blog-tutorial/app/routes/notes.tsx?browser
init_react();

// app/routes/notes.tsx
init_react();
var import_session = __toESM(require_session());
var import_note = __toESM(require_note());
function NotesPage() {
  const data = useLoaderData();
  const user = useUser();
  return /* @__PURE__ */ React.createElement("div", {
    className: "flex h-full min-h-screen flex-col"
  }, /* @__PURE__ */ React.createElement("header", {
    className: "flex items-center justify-between bg-slate-800 p-4 text-white"
  }, /* @__PURE__ */ React.createElement("h1", {
    className: "text-3xl font-bold"
  }, /* @__PURE__ */ React.createElement(Link, {
    to: "."
  }, "Notes")), /* @__PURE__ */ React.createElement("p", null, user.email), /* @__PURE__ */ React.createElement(Form, {
    action: "/logout",
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "rounded bg-slate-600 py-2 px-4 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
  }, "Logout"))), /* @__PURE__ */ React.createElement("main", {
    className: "flex h-full bg-white"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "h-full w-80 border-r bg-gray-50"
  }, /* @__PURE__ */ React.createElement(Link, {
    to: "new",
    className: "block p-4 text-xl text-blue-500"
  }, "+ New Note"), /* @__PURE__ */ React.createElement("hr", null), data.noteListItems.length === 0 ? /* @__PURE__ */ React.createElement("p", {
    className: "p-4"
  }, "No notes yet") : /* @__PURE__ */ React.createElement("ol", null, data.noteListItems.map((note) => /* @__PURE__ */ React.createElement("li", {
    key: note.id
  }, /* @__PURE__ */ React.createElement(NavLink, {
    className: ({ isActive }) => `block border-b p-4 text-xl ${isActive ? "bg-white" : ""}`,
    to: note.id
  }, "\u{1F4DD} ", note.title))))), /* @__PURE__ */ React.createElement("div", {
    className: "flex-1 p-6"
  }, /* @__PURE__ */ React.createElement(Outlet, null))));
}
export {
  NotesPage as default
};
//# sourceMappingURL=/build/routes/notes-2ZTE5UEY.js.map
