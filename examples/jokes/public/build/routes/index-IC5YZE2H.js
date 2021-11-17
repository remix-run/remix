import {
  Link
} from "/build/_shared/chunk-P2NWWZRW.js";
import {
  React,
  init_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// browser-route-module:/Users/kentcdodds/code/remix/examples/jokes/app/routes/index.tsx?browser
init_react();

// app/routes/index.tsx
init_react();

// app/styles/index.css
var styles_default = "/build/_assets/index-LQJHUV2J.css";

// app/routes/index.tsx
var meta = () => {
  return {
    title: "Remix: It's funny!",
    description: "Remix jokes app. Learn Remix and laugh at the same time!"
  };
};
var links = () => {
  return [{ rel: "stylesheet", href: styles_default }];
};
function Index() {
  return /* @__PURE__ */ React.createElement("div", {
    className: "container"
  }, /* @__PURE__ */ React.createElement("div", {
    className: "content"
  }, /* @__PURE__ */ React.createElement("h1", null, "Remix ", /* @__PURE__ */ React.createElement("span", null, "Jokes!")), /* @__PURE__ */ React.createElement("nav", null, /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(Link, {
    to: "jokes"
  }, "Read Jokes")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(Link, {
    reloadDocument: true,
    to: "/jokes.rss"
  }, "RSS"))))));
}
export {
  Index as default,
  links,
  meta
};
//# sourceMappingURL=/build/routes/index-IC5YZE2H.js.map
