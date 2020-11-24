'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var react = require('@remix-run/react');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

function meta() {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!"
  };
}
function Index() {
  let data = react.useRouteData();
  return /*#__PURE__*/React__default['default'].createElement("div", {
    style: {
      textAlign: "center",
      padding: 20
    }
  }, /*#__PURE__*/React__default['default'].createElement("h2", null, "Welcome to Remix!"), /*#__PURE__*/React__default['default'].createElement("p", null, /*#__PURE__*/React__default['default'].createElement("a", {
    href: "https://remix.run/dashboard/docs"
  }, "Check out the docs"), " to get started."), /*#__PURE__*/React__default['default'].createElement("p", null, "Message from the loader: ", data.message));
}

exports.default = Index;
exports.meta = meta;
