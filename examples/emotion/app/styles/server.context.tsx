import { createContext } from "react";

export interface ServerStyleContextData {
  key: string;
  ids: Array<string>;
  css: string;
}

const ServerStyleContext = createContext<null | ServerStyleContextData[]>(null);

export default ServerStyleContext;
