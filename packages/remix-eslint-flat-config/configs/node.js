import { node as nodeGlobals } from "globals";

export const nodeConfig = [
  {
    plugins: ["node"],
    languageOptions: {
      ...nodeGlobals,
    },
  },
];
