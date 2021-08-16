
import * as ______REACT_REFRESH______ from "esm-hmr/src/client";
if (!import.meta.hot) {
  import.meta.hot = ______REACT_REFRESH______.createHotContext("https://dev.remix.run/routes/gists.jsx");
}

if (!window.$RefreshReg$ || !window.$RefreshSig$ || !window.$RefreshRuntime$) {
  console.warn('@snowpack/plugin-react-refresh: HTML setup script not run. React Fast Refresh only works when Snowpack serves your HTML routes. You may want to remove this plugin.');
} else {
  var prevRefreshReg = window.$RefreshReg$;
  var prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = (type, id) => {
    window.$RefreshRuntime$.register(type, "/Users/jacob/git/remix/fixtures/gists-app/app/routes/gists.jsx" + " " + id);
  }
  window.$RefreshSig$ = window.$RefreshRuntime$.createSignatureFunctionForTransform;
}

var _s = $RefreshSig$();

import { Outlet } from "react-router-dom";
import { Link, useRouteData, usePendingLocation, json } from "remix";
import Shared from "../components/Shared";
import stylesHref from "../styles/gists.css";

function links() {
  return [{
    rel: "stylesheet",
    href: stylesHref
  }];
}

function loader() {
  let data = {
    users: [{
      id: "ryanflorence",
      name: "Ryan Florence"
    }, {
      id: "mjackson",
      name: "Michael Jackson"
    }]
  };
  return json(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
}

function headers({
  loaderHeaders
}) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}

let handle = {
  breadcrumb: () => /* @__PURE__ */React.createElement(Link, {
    to: "/gists"
  }, "Gists")
};

function Gists() {
  _s();

  let locationPending = usePendingLocation();
  let {
    users
  } = useRouteData();
  return /* @__PURE__ */React.createElement("div", {
    "data-test-id": "/gists"
  }, /* @__PURE__ */React.createElement("header", null, /* @__PURE__ */React.createElement("h1", null, "Gists"), /* @__PURE__ */React.createElement("ul", null, users.map(user => /* @__PURE__ */React.createElement("li", {
    key: user.id
  }, /* @__PURE__ */React.createElement(Link, {
    to: user.id,
    className: "text-blue-700 underline"
  }, user.name, " ", locationPending && "..."))))), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("button", {
    onClick: () => window.$RefreshRuntime$.performReactRefresh()
  }, "Do Reload!!!")), /* @__PURE__ */React.createElement(Outlet, null), /* @__PURE__ */React.createElement(Shared, null));
}

_s(Gists, "/iKOMvK5XBpP0aBo3bp2QkDFjGs=", false, function () {
  return [usePendingLocation, useRouteData];
});

_c = Gists;
export { Gists as default, handle, headers, links, loader };

var _c;

$RefreshReg$(_c, "Gists");
window.$RefreshReg$ = prevRefreshReg
window.$RefreshSig$ = prevRefreshSig
import.meta.hot.accept(() => {
  window.$RefreshRuntime$.performReactRefresh()
});
