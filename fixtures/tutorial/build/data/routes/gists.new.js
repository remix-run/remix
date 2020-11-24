"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loader = exports.action = void 0;
const data_1 = require("@remix-run/data");
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
            "content-type": "application/json"
        }
    });
    return data_1.redirect("/gists");
};
exports.action = action;
let loader = () => null;
exports.loader = loader;
