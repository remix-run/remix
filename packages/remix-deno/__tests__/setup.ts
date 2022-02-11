// @ts-nocheck
import { installGlobals } from "@remix-run/node";

installGlobals();

global.Deno = {
  readFile: jest.fn()
};

global.window = {};
