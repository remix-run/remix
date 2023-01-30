import { cli } from "@remix-run/dev";

let args = process.argv.slice(2);

cli
  .run(["create", ...args])
  .then(() => {
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error(args.includes("--debug") ? error : error.message);
    process.exit(1);
  });
