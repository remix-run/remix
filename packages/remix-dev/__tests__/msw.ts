import { rest } from "msw";
import { setupServer } from "msw/node";

let server = setupServer();
server.listen({ onUnhandledRequest: "warn" });
