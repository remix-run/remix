import type { Logger } from "../tux/logger";

type Mode = "development" | "production" | "test";

export type Options = {
  mode: Mode;
  liveReloadPort?: number;
  sourcemap: boolean;
  logger: Logger;
};
