'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var react = require('@remix-run/react');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

function NewGist() {
  let pendingForm = react.usePendingFormSubmit();
  return /*#__PURE__*/React__default['default'].createElement(React__default['default'].Fragment, null, /*#__PURE__*/React__default['default'].createElement("h2", null, "New Gist!"), pendingForm ? /*#__PURE__*/React__default['default'].createElement("div", null, /*#__PURE__*/React__default['default'].createElement("p", null, /*#__PURE__*/React__default['default'].createElement(Loading, null), " Creating gist: ", pendingForm.data.get("fileName"))) : /*#__PURE__*/React__default['default'].createElement(react.Form, {
    method: "post",
    action: "/gists"
  }, /*#__PURE__*/React__default['default'].createElement("p", null, /*#__PURE__*/React__default['default'].createElement("label", null, "Gist file name:", /*#__PURE__*/React__default['default'].createElement("br", null), /*#__PURE__*/React__default['default'].createElement("input", {
    required: true,
    type: "text",
    name: "fileName"
  }))), /*#__PURE__*/React__default['default'].createElement("p", null, /*#__PURE__*/React__default['default'].createElement("label", null, "Content:", /*#__PURE__*/React__default['default'].createElement("br", null), /*#__PURE__*/React__default['default'].createElement("textarea", {
    required: true,
    rows: 10,
    name: "content"
  }))), /*#__PURE__*/React__default['default'].createElement("p", null, /*#__PURE__*/React__default['default'].createElement("button", {
    type: "submit"
  }, "Create Gist"))));
}

function Loading() {
  return /*#__PURE__*/React__default['default'].createElement("svg", {
    className: "spin",
    style: {
      height: "1rem"
    },
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor"
  }, /*#__PURE__*/React__default['default'].createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
  }));
}

exports.default = NewGist;
