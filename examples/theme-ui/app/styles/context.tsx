import React, { createContext } from "react";

export interface ServerStyleContextData {
  key: string;
  ids: Array<string>;
  css: string;
}

export const ServerStyleContext = createContext<
  ServerStyleContextData[] | null
>(null);

export interface ClientStyleContextData {
  reset: () => void;
}

export const ClientStyleContext = createContext<ClientStyleContextData | null>(
  null
);
