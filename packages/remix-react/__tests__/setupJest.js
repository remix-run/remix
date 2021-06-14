let nf = require("node-fetch");
let ac = require("abort-controller");
global.AbortController = ac.AbortController;
global.Headers = nf.Headers;
global.Response = nf.Response;
global.Request = nf.Request;
global.fetch = nf;
