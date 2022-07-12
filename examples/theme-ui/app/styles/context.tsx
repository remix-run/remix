import { createContext } from "react";

export type ServerStyleContextData = {
  key: string;
  ids: string[];
  css: string;
};

export const ServerStyleContext = createContext<
  ServerStyleContextData[] | null
>(null);

export type ClientStyleContextData = {
  reset: () => void;
};

export const ClientStyleContext = createContext<ClientStyleContextData | null>(
  null
);
