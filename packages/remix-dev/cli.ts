import { cli } from "./index";

cli.run().catch((error: unknown) => {
  if (error) console.error(error);
  process.exit(1);
});
