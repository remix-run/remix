'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var react = require('@remix-run/react');
var reactRouterDom = require('react-router-dom');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefaultLegacy(React);

function Team() {
  let data = react.useRouteData();
  return /*#__PURE__*/React__default['default'].createElement("div", null, /*#__PURE__*/React__default['default'].createElement("h2", null, "Team"), /*#__PURE__*/React__default['default'].createElement("ul", null, data.map(member => /*#__PURE__*/React__default['default'].createElement("li", {
    key: member.id
  }, /*#__PURE__*/React__default['default'].createElement(reactRouterDom.Link, {
    to: member.login
  }, member.login)))), /*#__PURE__*/React__default['default'].createElement("hr", null), /*#__PURE__*/React__default['default'].createElement(reactRouterDom.Outlet, null));
}

exports.default = Team;
