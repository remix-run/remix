type Mode = "development" | "production" | "test";

export type Options = {
  mode: Mode;
  sourcemap: boolean;
  perfDebug: boolean;

  // TODO: required in v2
  devOrigin?: {
    scheme: string;
    host: string;
    port: number;
  };
};
