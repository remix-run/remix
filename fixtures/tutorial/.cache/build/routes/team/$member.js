'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var react = require('@remix-run/react');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

function TeamMember() {
  let user = react.useRouteData();
  return /*#__PURE__*/React__default['default'].createElement("div", null, /*#__PURE__*/React__default['default'].createElement("h3", null, user.name), /*#__PURE__*/React__default['default'].createElement("img", {
    alt: "user avatar",
    src: user.avatar_url,
    height: "50"
  }), /*#__PURE__*/React__default['default'].createElement("p", null, user.bio), /*#__PURE__*/React__default['default'].createElement("dl", null, /*#__PURE__*/React__default['default'].createElement("dt", null, "Company"), /*#__PURE__*/React__default['default'].createElement("dd", null, user.company), /*#__PURE__*/React__default['default'].createElement("dt", null, "Location"), /*#__PURE__*/React__default['default'].createElement("dd", null, user.location)));
}

exports.default = TeamMember;
