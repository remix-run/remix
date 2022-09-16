import { node as nodeGlobals } from "globals";
import nodePlugin from "eslint-plugin-node";

export const nodeConfig = [
  {
    plugins: [nodePlugin],
    languageOptions: {
      ...nodeGlobals,
    },
  },
];
