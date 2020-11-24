"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loader = void 0;
let loader = ({ params }) => {
    return fetch(`https://api.github.com/users/${params.member}`);
};
exports.loader = loader;
