"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loader = exports.action = void 0;
const data_1 = require("@remix-run/data");
let loader = () => {
    return fetch("https://api.github.com/gists");
};
exports.loader = loader;
let action = async ({ request }) => {
    let body = await data_1.parseFormBody(request);
    let fileName = body.get("fileName");
    let content = body.get("content");
    await fetch("https://api.github.com/gists", {
        method: "post",
        body: JSON.stringify({
            description: "Created from Remix Form!",
            public: true,
            files: { [fileName]: { content } }
        }),
        headers: {
            "content-type": "application/json",
            authorization: "token 7dd12d0c5824ed0b42add15b296fa2d6522e870b"
        }
    });
    return data_1.redirect("/gists");
};
exports.action = action;
