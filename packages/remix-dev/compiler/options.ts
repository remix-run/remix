import type { Logger } from "../tux/logger";

type Mode = "development" | "production" | "test";

export type Options = {
  mode: Mode;
  sourcemap: boolean;
  logger: Logger;

  // TODO: required in v2
  devOrigin?: {
    scheme: string;
    host: string;
    port: number;
  };
};
