import {
  require_session
} from "/build/_shared/chunk-JHG2B4Q5.js";
import {
  require_db
} from "/build/_shared/chunk-SMZ7NZN3.js";
import {
  Form,
  Link,
  require_main,
  useCatch,
  useLoaderData
} from "/build/_shared/chunk-P2NWWZRW.js";
import {
  React,
  __toModule,
  init_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// browser-route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/jokes/$jokeId.tsx?browser
init_react();

// app/routes/jokes/$jokeId.tsx
init_react();
var import_react_router_dom = __toModule(require_main());
var import_db = __toModule(require_db());
var import_session = __toModule(require_session());
var meta = ({ data }) => {
  return {
    title: `"${data.joke.name}" joke`,
    description: `Enjoy the "${data.joke.name}" joke and much more`
  };
};
function JokeRoute() {
  let data = useLoaderData();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Here's your hilarious joke:"), /* @__PURE__ */ React.createElement("p", null, data.joke.content), /* @__PURE__ */ React.createElement(Link, {
    to: "."
  }, data.joke.name, " Permalink"), data.isOwner ? /* @__PURE__ */ React.createElement(Form, {
    method: "delete"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    className: "button"
  }, "Delete")) : null);
}
function CatchBoundary() {
  let caught = useCatch();
  let params = (0, import_react_router_dom.useParams)();
  switch (caught.status) {
    case 404: {
      return /* @__PURE__ */ React.createElement("div", null, "Huh? What the heck is ", params.jokeId, "?");
    }
    case 401: {
      return /* @__PURE__ */ React.createElement("div", null, "Sorry, but ", params.jokeId, " is not your joke.");
    }
    default: {
      throw new Error(`Unhandled error: ${caught.status}`);
    }
  }
}
export {
  CatchBoundary,
  JokeRoute as default,
  meta
};
//# sourceMappingURL=/build/routes/jokes/$jokeId-PD562G6I.js.map
