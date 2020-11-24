'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var ReactDOMServer = require('react-dom/server');
var Remix = require('@remix-run/react/server');
var react = require('@remix-run/react');
var reactRouterDom = require('react-router-dom');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);
var ReactDOMServer__default = /*#__PURE__*/_interopDefaultLegacy(ReactDOMServer);
var Remix__default = /*#__PURE__*/_interopDefaultLegacy(Remix);

function App() {
  let data = react.useGlobalData();
  return /*#__PURE__*/React__default['default'].createElement("html", {
    lang: "en"
  }, /*#__PURE__*/React__default['default'].createElement("head", null, /*#__PURE__*/React__default['default'].createElement("meta", {
    charSet: "utf-8"
  }), /*#__PURE__*/React__default['default'].createElement(react.Meta, null), /*#__PURE__*/React__default['default'].createElement(react.Styles, null)), /*#__PURE__*/React__default['default'].createElement("body", null, /*#__PURE__*/React__default['default'].createElement(reactRouterDom.Link, {
    to: "/gists"
  }, "Gists"), /*#__PURE__*/React__default['default'].createElement(react.Routes, null), /*#__PURE__*/React__default['default'].createElement(react.Scripts, null), /*#__PURE__*/React__default['default'].createElement("footer", null, /*#__PURE__*/React__default['default'].createElement("p", null, "This page was rendered at ", data.date.toLocaleString()))));
}

function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  let markup = ReactDOMServer__default['default'].renderToString( /*#__PURE__*/React__default['default'].createElement(Remix__default['default'], {
    context: remixContext,
    url: request.url
  }, /*#__PURE__*/React__default['default'].createElement(App, null)));
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: { ...Object.fromEntries(responseHeaders),
      "Content-Type": "text/html"
    }
  });
}

exports.default = handleRequest;
