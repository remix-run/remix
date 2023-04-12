import { bold, dim, green } from "picocolors";

let version = "1.16.0";

export let header = (title: string, description?: string) => {
  return bold(green(title + " v" + version)) + " " + dim(description);
};
