import {
  require_note
} from "/build/_shared/chunk-BURPMA5Y.js";
import {
  require_session
} from "/build/_shared/chunk-3UULGQSB.js";
import {
  Form,
  useCatch,
  useLoaderData
} from "/build/_shared/chunk-DOPJ42JF.js";
import {
  React,
  __toESM,
  init_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// browser-route-module:/Users/johnhooks/Projects/remix/examples/blog-tutorial/app/routes/notes/$noteId.tsx?browser
init_react();

// app/routes/notes/$noteId.tsx
init_react();
var import_note = __toESM(require_note());
var import_note2 = __toESM(require_note());
var import_session = __toESM(require_session());
function NoteDetailsPage() {
  const data = useLoaderData();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", {
    className: "text-2xl font-bold"
  }, data.note.title), /* @__PURE__ */ React.createElement("p", {
    className: "py-6"
  }, data.note.body), /* @__PURE__ */ React.createElement("hr", {
    className: "my-4"
  }), /* @__PURE__ */ React.createElement(Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "rounded bg-blue-500  py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
  }, "Delete")));
}
function ErrorBoundary({ error }) {
  console.error(error);
  return /* @__PURE__ */ React.createElement("div", null, "An unexpected error occurred: ", error.message);
}
function CatchBoundary() {
  const caught = useCatch();
  if (caught.status === 404) {
    return /* @__PURE__ */ React.createElement("div", null, "Note not found");
  }
  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}
export {
  CatchBoundary,
  ErrorBoundary,
  NoteDetailsPage as default
};
//# sourceMappingURL=/build/routes/notes/$noteId-2J5GE3EP.js.map
