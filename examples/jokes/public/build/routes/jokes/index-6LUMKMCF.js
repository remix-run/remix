import {
  require_db
} from "/build/_shared/chunk-SMZ7NZN3.js";
import {
  Link,
  useCatch,
  useLoaderData
} from "/build/_shared/chunk-P2NWWZRW.js";
import {
  React,
  __toModule,
  init_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// browser-route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes/index.tsx?browser
init_react();

// app/routes/jokes/index.tsx
init_react();
var import_db = __toModule(require_db());
function JokesIndexRoute() {
  let data = useLoaderData();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Here's a random joke:"), /* @__PURE__ */ React.createElement("p", null, data.randomJoke.content), /* @__PURE__ */ React.createElement(Link, {
    to: data.randomJoke.id
  }, '"', data.randomJoke.name, '" Permalink'));
}
function CatchBoundary() {
  let caught = useCatch();
  switch (caught.status) {
    case 404: {
      return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "There are no jokes to display."), /* @__PURE__ */ React.createElement(Link, {
        to: "new"
      }, "Add your own"));
    }
    default: {
      throw new Error(`Unexpected caught response with status: ${caught.status}`);
    }
  }
}
function ErrorBoundary({ error }) {
  console.error(error);
  return /* @__PURE__ */ React.createElement("div", null, "I did a whoopsies.");
}
export {
  CatchBoundary,
  ErrorBoundary,
  JokesIndexRoute as default
};
//# sourceMappingURL=/build/routes/jokes/index-6LUMKMCF.js.map
