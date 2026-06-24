import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { initializeDatabase } from "./app/db/driver.ts";
import { router } from "./app/router.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

await initializeDatabase();

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request);
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error);
      }
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
