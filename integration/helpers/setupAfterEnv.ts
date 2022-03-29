import { installGlobals } from "@remix-run/node";
require("expect-puppeteer");
installGlobals();

jest.setTimeout(10000);
