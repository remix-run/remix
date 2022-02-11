// @ts-nocheck
import * as AbortController from "abort-controller";
import * as nodeFetch from "@remix-run/node/fetch";

global.AbortController = AbortController.AbortController;
global.Headers = nodeFetch.Headers;
global.Response = nodeFetch.Response;
global.Request = nodeFetch.Request;
global.fetch = nodeFetch;
