import type { DataLoader } from "@remix-run/core";

let loader: DataLoader = async () => {
  return {
    message: "this is awesome 😎"
  };
};

export { loader };
