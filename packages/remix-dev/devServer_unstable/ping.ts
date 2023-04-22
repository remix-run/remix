import type { ServerBuild } from "@remix-run/server-runtime";

export let ping = (build: ServerBuild) => {
  let httpPort = Number(process.env.REMIX_DEV_HTTP_PORT);
  if (!httpPort) throw Error("REMIX_DEV_HTTP_PORT not set");
  if (isNaN(httpPort))
    throw Error(`REMIX_DEV_HTTP_PORT must be a number. Got: ${httpPort}`);

  fetch(`http://localhost:${httpPort}/ping`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ buildHash: build.assets.version }),
  });
};
