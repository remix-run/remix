'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var react = require('@remix-run/react');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

function meta() {
  return {
    title: "Public Gists",
    description: "View the latest gists from the public"
  };
}
function headers({
  loaderHeaders
}) {
  return {
    "cache-control": loaderHeaders.get("cache-control")
  };
}
function Gists() {
  let data = react.useRouteData();
  return /*#__PURE__*/React__default['default'].createElement("div", null, /*#__PURE__*/React__default['default'].createElement("h2", null, "Public Gists"), /*#__PURE__*/React__default['default'].createElement("ul", null, data.map(gist => /*#__PURE__*/React__default['default'].createElement("li", {
    key: gist.id
  }, /*#__PURE__*/React__default['default'].createElement("a", {
    href: gist.html_url
  }, Object.keys(gist.files)[0])))));
}

exports.default = Gists;
exports.headers = headers;
exports.meta = meta;
