import { cli } from "@remix-run/dev";

cli.run().then(
  () => {
    process.exit(0);
  },
  (error: Error) => {
    console.error(error);
    process.exit(1);
  }
);
