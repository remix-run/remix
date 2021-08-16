
import * as ______REACT_REFRESH______ from "@remix-run/dev/hmr-runtime";
import.meta.hot = ______REACT_REFRESH______.createHotContext("app/routes/index.tsx");

if (!window.$RefreshReg$ || !window.$RefreshSig$ || !window.$RefreshRuntime$) {
  console.warn('@remix-run/react-refresh: HTML setup script not run. React Fast Refresh only works when Snowpack serves your HTML routes. You may want to remove this plugin.');
} else {
  var prevRefreshReg = window.$RefreshReg$;
  var prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = (type, id) => {
    window.$RefreshRuntime$.register(type, "app/routes/index.tsx" + id);
  }
  window.$RefreshSig$ = window.$RefreshRuntime$.createSignatureFunctionForTransform;
}

var _s = $RefreshSig$();

import { useRouteData } from "remix";
import styles from "../styles/index.css";

let loader = async () => {
  return {
    message: "this is nice \u{1F60E}"
  };
};

let links = () => {
  return [{
    rel: "stylesheet",
    href: styles
  }];
};

function meta() {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!"
  };
}

function Index() {
  _s();

  let data = useRouteData();
  return /* @__PURE__ */React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 20
    }
  }, /* @__PURE__ */React.createElement("h2", null, "Welcome to Remix 2!"), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("a", {
    href: "https://remix.run/dashboard/docs"
  }, "Check out the docs"), " to get started."), /* @__PURE__ */React.createElement("p", null, "Message from the loader: ", data.message));
}

_s(Index, "JWn6jUhSkxDpxtoFS7gSe0Eljiw=", false, function () {
  return [useRouteData];
});

_c = Index;
export { Index as default, links, loader, meta };

var _c;

$RefreshReg$(_c, "Index");
window.$RefreshReg$ = prevRefreshReg;
window.$RefreshSig$ = prevRefreshSig;
import.meta.hot.accept(({ module }) => {
  window.$RefreshRuntime$.performReactRefresh();
});
