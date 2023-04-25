type Mode = "development" | "production" | "test";

export type Options = {
  mode: Mode;
  sourcemap: boolean;
  onWarning?: (message: string, key: string) => void;
  devWebsocketPort?: number;
};
